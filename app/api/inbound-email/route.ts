import { NextRequest, NextResponse } from 'next/server'
import { simpleParser } from 'mailparser'
import { supabase } from '@/lib/supabase'
import { processInboundEmail } from '@/lib/actions'

export async function POST(request: NextRequest) {
  try {
    // Mailgun은 multipart/form-data로 데이터를 전송합니다
    const formData = await request.formData()
    
    // Mailgun의 'body-mime' 필드에서 MIME 형식의 이메일을 가져옵니다
    const bodyMime = formData.get('body-mime')
    
    if (!bodyMime || typeof bodyMime !== 'string') {
      return NextResponse.json(
        { error: 'Missing body-mime field' },
        { status: 400 }
      )
    }

    // MIME 파싱
    const parsed = await simpleParser(bodyMime)

    // 이메일 데이터 추출
    const sender = parsed.from?.text || parsed.from?.value?.[0]?.address || ''
    const recipient = parsed.to?.text || parsed.to?.value?.[0]?.address || ''
    const recipientEmail = parsed.to?.value?.[0]?.address || ''
    const subject = parsed.subject || ''
    const bodyText = parsed.text || ''
    const bodyHtml = parsed.html || ''
    const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString()
    const messageId = parsed.messageId || ''
    const inReplyTo = parsed.inReplyTo || null
    const references = parsed.references 
      ? (Array.isArray(parsed.references) ? parsed.references.join(', ') : parsed.references) 
      : null

    // Find user by email address (recipient) using database function
    let userId: string | null = null
    if (recipientEmail) {
      try {
        // Use the database function to get user_id by email
        const { data: userData, error: userError } = await supabase
          .rpc('get_user_id_by_email', { email_address: recipientEmail.toLowerCase() })
        
        if (!userError && userData) {
          userId = userData
          console.log(`Found user ${userId} for email: ${recipientEmail}`)
        } else {
          console.log(`User not found for email: ${recipientEmail}`)
        }
      } catch (error) {
        console.error('Error finding user by email:', error)
        // Continue without user_id - email will be saved but not associated
      }
    }
    
    // Headers를 JSONB 형식으로 변환
    const headers = parsed.headers ? Object.fromEntries(
      Object.entries(parsed.headers).map(([key, value]) => [key, value])
    ) : {}
    
    // Attachments를 JSONB 형식으로 변환
    const attachments = parsed.attachments?.map((att) => ({
      filename: att.filename || 'unknown',
      content_type: att.contentType || 'application/octet-stream',
      size: att.size || 0,
    })) || []

    // Snippet 생성 (body_text의 첫 200자)
    const snippet = bodyText ? bodyText.substring(0, 200).trim() : ''

    // Supabase에 저장
    const { data, error } = await supabase
      .from('emails')
      .insert({
        user_id: userId, // Automatically link to user if found
        sender: sender,
        subject: subject,
        body_text: bodyText,
        body_html: bodyHtml,
        received_at: receivedAt,
        message_id: messageId,
        in_reply_to: inReplyTo,
        references: references,
        headers: headers,
        attachments: attachments,
        raw_mime: bodyMime,
        snippet: snippet,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save email', details: error.message },
        { status: 500 }
      )
    }

    // Process email asynchronously (summary + topic classification)
    // Don't await - return response immediately and process in background
    processInboundEmail(data.id)
      .then((result) => {
        if (result.success) {
          console.log(`Email ${data.id} processed successfully:`, {
            summary: result.summary?.success ? 'created' : 'failed',
            topics: result.topics?.success 
              ? `classified as: ${result.topics.topicNames?.join(', ')}`
              : 'failed',
          })
        } else {
          console.error(`Email ${data.id} processing failed:`, result.error)
        }
      })
      .catch((err) => {
        console.error(`Error in background processing for email ${data.id}:`, err)
      })

    return NextResponse.json(
      { 
        success: true, 
        message: 'Email processed and saved. Summary and topic classification in progress.',
        email_id: data.id 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error processing inbound email:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Mailgun webhook 검증을 위한 GET 핸들러 (선택사항)
export async function GET() {
  return NextResponse.json({ 
    message: 'Mailgun inbound email webhook endpoint',
    method: 'POST'
  })
}

