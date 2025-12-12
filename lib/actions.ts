'use server'

import OpenAI from 'openai'
import { supabase } from './supabase'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface EmailSummaryResult {
  success: boolean
  summary?: string
  bullets?: string[]
  error?: string
}

interface TopicClassificationResult {
  success: boolean
  topicIds?: string[]
  topicNames?: string[]
  error?: string
}

interface ProcessInboundEmailResult {
  success: boolean
  emailId: string
  summary?: {
    success: boolean
    summary?: string
    bullets?: string[]
    error?: string
  }
  topics?: {
    success: boolean
    topicIds?: string[]
    topicNames?: string[]
    error?: string
  }
  error?: string
}

/**
 * Create email summary and bullet points using OpenAI
 * @param emailId - The ID of the email to summarize
 * @returns Summary and bullet points, or error message
 */
export async function createEmailSummary(emailId: string): Promise<EmailSummaryResult> {
  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key is not configured',
      }
    }

    // Fetch email from Supabase
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('id, subject, body_html, body_text, summary, bullets')
      .eq('id', emailId)
      .single()

    if (emailError || !email) {
      return {
        success: false,
        error: `Email not found: ${emailError?.message || 'Unknown error'}`,
      }
    }

    // Check if summary already exists
    if (email.summary && email.bullets && (email.bullets as string[]).length > 0) {
      return {
        success: true,
        summary: email.summary,
        bullets: email.bullets as string[],
      }
    }

    // Get email content (prefer HTML, fallback to text)
    const emailContent = email.body_html || email.body_text || ''
    
    if (!emailContent || emailContent.trim().length === 0) {
      return {
        success: false,
        error: 'Email body is empty',
      }
    }

    // Prepare prompt for OpenAI
    const prompt = `Please analyze the following email and provide:
1. A concise summary (2-3 sentences) that captures the main points
2. 3-5 bullet points highlighting the key takeaways

Email Subject: ${email.subject || 'No subject'}

Email Content:
${emailContent.substring(0, 8000)}${emailContent.length > 8000 ? '...' : ''}

Please respond in the following JSON format:
{
  "summary": "Your concise summary here",
  "bullets": ["Bullet point 1", "Bullet point 2", "Bullet point 3"]
}`

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at summarizing newsletters and emails. Provide clear, concise summaries and actionable bullet points. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500,
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      return {
        success: false,
        error: 'No response from OpenAI',
      }
    }

    // Parse JSON response
    let parsedResponse: { summary: string; bullets: string[] }
    try {
      parsedResponse = JSON.parse(responseContent)
    } catch (parseError) {
      // Try to extract summary and bullets from text if JSON parsing fails
      console.error('Failed to parse OpenAI response as JSON:', responseContent)
      return {
        success: false,
        error: 'Failed to parse OpenAI response',
      }
    }

    const summary = parsedResponse.summary?.trim() || ''
    const bullets = Array.isArray(parsedResponse.bullets)
      ? parsedResponse.bullets.filter((b) => b && b.trim().length > 0)
      : []

    if (!summary || bullets.length === 0) {
      return {
        success: false,
        error: 'Invalid response format from OpenAI',
      }
    }

    // Update email in Supabase
    const { error: updateError } = await supabase
      .from('emails')
      .update({
        summary: summary,
        bullets: bullets,
      })
      .eq('id', emailId)

    if (updateError) {
      console.error('Error updating email:', updateError)
      return {
        success: false,
        error: `Failed to update email: ${updateError.message}`,
      }
    }

    return {
      success: true,
      summary,
      bullets,
    }
  } catch (error) {
    console.error('Error creating email summary:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Classify email topics based on subject and body using OpenAI
 * @param emailId - The ID of the email to classify
 * @returns Classified topic IDs and names, or error message
 */
export async function classifyTopics(emailId: string): Promise<TopicClassificationResult> {
  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key is not configured',
      }
    }

    // Fetch email from Supabase
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('id, subject, body_html, body_text')
      .eq('id', emailId)
      .single()

    if (emailError || !email) {
      return {
        success: false,
        error: `Email not found: ${emailError?.message || 'Unknown error'}`,
      }
    }

    // Get email content (prefer HTML, fallback to text)
    const emailContent = email.body_html || email.body_text || ''
    
    if (!emailContent || emailContent.trim().length === 0) {
      return {
        success: false,
        error: 'Email body is empty',
      }
    }

    // Fetch all available topics from Supabase
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, name')
      .order('name', { ascending: true })

    if (topicsError || !topics || topics.length === 0) {
      return {
        success: false,
        error: `Failed to fetch topics: ${topicsError?.message || 'No topics found'}`,
      }
    }

    // Check if email already has topics assigned
    const { data: existingTopics } = await supabase
      .from('email_topics')
      .select('topic_id')
      .eq('email_id', emailId)

    if (existingTopics && existingTopics.length > 0) {
      // Return existing topics
      const existingTopicIds = existingTopics.map((et) => et.topic_id)
      const existingTopicNames = topics
        .filter((t) => existingTopicIds.includes(t.id))
        .map((t) => t.name)

      return {
        success: true,
        topicIds: existingTopicIds,
        topicNames: existingTopicNames,
      }
    }

    // Prepare topic list for OpenAI
    const topicNames = topics.map((t) => t.name)
    const topicList = topicNames.join(', ')

    // Prepare prompt for OpenAI
    const prompt = `Analyze the following email and classify it into one or more relevant topics from this list: ${topicList}

Email Subject: ${email.subject || 'No subject'}

Email Content:
${emailContent.substring(0, 6000)}${emailContent.length > 6000 ? '...' : ''}

Based on the email content, select the most relevant topic(s) from the list: ${topicList}

Please respond in the following JSON format:
{
  "topics": ["Topic1", "Topic2"]
}

Only include topics that are directly relevant to the email content. If multiple topics are relevant, include all of them. If no topics match well, choose the single most relevant one.`

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at categorizing emails and newsletters into topics. You will be given a list of available topics and an email. Your task is to classify the email into the most relevant topic(s) from the provided list. Always respond with valid JSON only.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent classification
      max_tokens: 200,
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      return {
        success: false,
        error: 'No response from OpenAI',
      }
    }

    // Parse JSON response
    let parsedResponse: { topics: string[] }
    try {
      parsedResponse = JSON.parse(responseContent)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', responseContent)
      return {
        success: false,
        error: 'Failed to parse OpenAI response',
      }
    }

    const classifiedTopicNames = Array.isArray(parsedResponse.topics)
      ? parsedResponse.topics.filter((t) => t && t.trim().length > 0)
      : []

    if (classifiedTopicNames.length === 0) {
      return {
        success: false,
        error: 'No topics classified from OpenAI response',
      }
    }

    // Map topic names to topic IDs
    const topicNameToId = new Map(topics.map((t) => [t.name.toLowerCase(), t.id]))
    const matchedTopicIds: string[] = []
    const matchedTopicNames: string[] = []

    for (const topicName of classifiedTopicNames) {
      // Try exact match first
      const topicId = topicNameToId.get(topicName.toLowerCase())
      if (topicId) {
        matchedTopicIds.push(topicId)
        matchedTopicNames.push(topicName)
      } else {
        // Try fuzzy matching (case-insensitive partial match)
        const matchedTopic = topics.find(
          (t) => t.name.toLowerCase().includes(topicName.toLowerCase()) ||
                 topicName.toLowerCase().includes(t.name.toLowerCase())
        )
        if (matchedTopic && !matchedTopicIds.includes(matchedTopic.id)) {
          matchedTopicIds.push(matchedTopic.id)
          matchedTopicNames.push(matchedTopic.name)
        }
      }
    }

    if (matchedTopicIds.length === 0) {
      return {
        success: false,
        error: `Could not match classified topics "${classifiedTopicNames.join(', ')}" to available topics`,
      }
    }

    // Insert topic associations into email_topics table
    const emailTopicsToInsert = matchedTopicIds.map((topicId) => ({
      email_id: emailId,
      topic_id: topicId,
    }))

    const { error: insertError } = await supabase
      .from('email_topics')
      .insert(emailTopicsToInsert)

    if (insertError) {
      console.error('Error inserting email topics:', insertError)
      return {
        success: false,
        error: `Failed to save topic classifications: ${insertError.message}`,
      }
    }

    return {
      success: true,
      topicIds: matchedTopicIds,
      topicNames: matchedTopicNames,
    }
  } catch (error) {
    console.error('Error classifying topics:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Process inbound email: create summary and classify topics
 * This function orchestrates the full processing pipeline for a newly received email
 * @param emailId - The ID of the email to process
 * @returns Processing results including summary and topic classification
 */
export async function processInboundEmail(emailId: string): Promise<ProcessInboundEmailResult> {
  try {
    // Step 1: Create email summary
    const summaryResult = await createEmailSummary(emailId)
    
    // Step 2: Classify topics (even if summary failed, we can still try to classify)
    const topicsResult = await classifyTopics(emailId)

    // Determine overall success
    const overallSuccess = summaryResult.success || topicsResult.success

    if (!overallSuccess) {
      return {
        success: false,
        emailId,
        summary: summaryResult,
        topics: topicsResult,
        error: `Processing failed. Summary: ${summaryResult.error || 'success'}, Topics: ${topicsResult.error || 'success'}`,
      }
    }

    return {
      success: true,
      emailId,
      summary: summaryResult,
      topics: topicsResult,
    }
  } catch (error) {
    console.error('Error processing inbound email:', error)
    return {
      success: false,
      emailId,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
