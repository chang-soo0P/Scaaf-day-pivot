-- ============================================
-- Supabase Schema for Scaaf Day Newsletter
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Function to get user_id by email
-- This function allows the API to find users by email address
-- ============================================
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_address TEXT)
RETURNS UUID AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = LOWER(email_address)
  LIMIT 1;
  
  RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Topics Table
-- ============================================
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for topic lookups
CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);
CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name);

-- ============================================
-- Emails Table
-- ============================================
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Additional email metadata
  newsletter_title TEXT,
  snippet TEXT,
  summary TEXT,
  bullets JSONB DEFAULT '[]'::jsonb,
  has_ad_segment BOOLEAN DEFAULT FALSE,
  issue_image_emoji TEXT,
  
  -- Email headers and metadata
  message_id TEXT,
  in_reply_to TEXT,
  references TEXT,
  headers JSONB,
  attachments JSONB DEFAULT '[]'::jsonb,
  raw_mime TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for emails
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
CREATE INDEX IF NOT EXISTS idx_emails_subject ON emails(subject);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);

-- ============================================
-- Email Topics Junction Table (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS email_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique email-topic pairs
  UNIQUE(email_id, topic_id)
);

-- Indexes for email_topics
CREATE INDEX IF NOT EXISTS idx_email_topics_email_id ON email_topics(email_id);
CREATE INDEX IF NOT EXISTS idx_email_topics_topic_id ON email_topics(topic_id);

-- ============================================
-- Highlights Table
-- ============================================
CREATE TABLE IF NOT EXISTS highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  quote TEXT NOT NULL,
  memo TEXT,
  created_by TEXT NOT NULL, -- User ID or name
  topic_tag TEXT,
  is_ad_related BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for highlights
CREATE INDEX IF NOT EXISTS idx_highlights_email_id ON highlights(email_id);
CREATE INDEX IF NOT EXISTS idx_highlights_created_by ON highlights(created_by);
CREATE INDEX IF NOT EXISTS idx_highlights_topic_tag ON highlights(topic_tag);
CREATE INDEX IF NOT EXISTS idx_highlights_created_at ON highlights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_is_shared ON highlights(is_shared);

-- ============================================
-- Comments Table
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar_color TEXT,
  avatar TEXT,
  text TEXT NOT NULL,
  reactions JSONB DEFAULT '[]'::jsonb, -- Array of {emoji: string, count: number, reacted?: boolean}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_email_id ON comments(email_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author_name ON comments(author_name);

-- ============================================
-- Updated At Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_topics_updated_at
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_highlights_updated_at
  BEFORE UPDATE ON highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- Enable RLS on all tables
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust based on your auth requirements)
-- For now, allow all operations for authenticated users
-- You should customize these based on your authentication setup

-- Topics: Allow read for all, write for authenticated
CREATE POLICY "Topics are viewable by everyone"
  ON topics FOR SELECT
  USING (true);

CREATE POLICY "Topics are insertable by authenticated users"
  ON topics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Topics are updatable by authenticated users"
  ON topics FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Emails: Users can only see and manage their own emails
CREATE POLICY "Users can view their own emails"
  ON emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own emails"
  ON emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emails"
  ON emails FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emails"
  ON emails FOR DELETE
  USING (auth.uid() = user_id);

-- Email Topics: Users can only manage topics for their own emails
CREATE POLICY "Users can view email topics for their emails"
  ON email_topics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = email_topics.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert email topics for their emails"
  ON email_topics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = email_topics.email_id
      AND emails.user_id = auth.uid()
    )
  );

-- Highlights: Users can only manage highlights for their own emails
CREATE POLICY "Users can view highlights for their emails"
  ON highlights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = highlights.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert highlights for their emails"
  ON highlights FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = highlights.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update highlights for their emails"
  ON highlights FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = highlights.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete highlights for their emails"
  ON highlights FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = highlights.email_id
      AND emails.user_id = auth.uid()
    )
  );

-- Comments: Users can only manage comments for their own emails
CREATE POLICY "Users can view comments for their emails"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = comments.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comments for their emails"
  ON comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = comments.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update comments for their emails"
  ON comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = comments.email_id
      AND emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete comments for their emails"
  ON comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM emails
      WHERE emails.id = comments.email_id
      AND emails.user_id = auth.uid()
    )
  );

-- ============================================
-- Helper Views (Optional)
-- ============================================
-- View for emails with topic names
CREATE OR REPLACE VIEW emails_with_topics AS
SELECT 
  e.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'slug', t.slug
      )
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::json
  ) AS topics
FROM emails e
LEFT JOIN email_topics et ON e.id = et.email_id
LEFT JOIN topics t ON et.topic_id = t.id
GROUP BY e.id;

-- View for email statistics
CREATE OR REPLACE VIEW email_stats AS
SELECT 
  e.id AS email_id,
  COUNT(DISTINCT h.id) AS highlight_count,
  COUNT(DISTINCT c.id) AS comment_count,
  COUNT(DISTINCT et.topic_id) AS topic_count
FROM emails e
LEFT JOIN highlights h ON e.id = h.email_id
LEFT JOIN comments c ON e.id = c.email_id
LEFT JOIN email_topics et ON e.id = et.email_id
GROUP BY e.id;




