# frozen_string_literal: true

# Security headers configuration
Rails.application.config.action_dispatch.default_headers.merge!({
  'X-Frame-Options' => 'SAMEORIGIN',
  'X-XSS-Protection' => '1; mode=block',
  'X-Content-Type-Options' => 'nosniff',
  'X-Download-Options' => 'noopen',
  'X-Permitted-Cross-Domain-Policies' => 'none',
  'Referrer-Policy' => 'strict-origin-when-cross-origin',
  'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains'
})