// ============================================================
// Secret Pattern Definitions
// ============================================================

export interface SecretPattern {
  name: string;
  secretType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  regex: RegExp;
  description: string;
  remediation: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // ── AWS ──────────────────────────────────────────────────
  {
    name: 'aws_access_key',
    secretType: 'AWS Access Key ID',
    severity: 'critical',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    description: 'AWS Access Key ID detected. This can be used to authenticate to AWS services.',
    remediation: 'Revoke this key immediately in AWS IAM console, rotate all associated permissions, and use IAM roles or environment variables instead.',
  },
  {
    name: 'aws_secret_key',
    secretType: 'AWS Secret Access Key',
    severity: 'critical',
    regex: /(?:aws[_\-\s]?secret[_\-\s]?(?:access[_\-\s]?)?key|aws[_\-\s]?secret)\s*[=:]\s*['""]?([A-Za-z0-9\/\+=]{40})['""]?/gi,
    description: 'AWS Secret Access Key detected. Combined with an Access Key ID, this provides full API access.',
    remediation: 'Revoke immediately in AWS IAM, use AWS Secrets Manager or environment variables.',
  },
  // ── GitHub ───────────────────────────────────────────────
  {
    name: 'github_personal_token',
    secretType: 'GitHub Personal Access Token',
    severity: 'critical',
    regex: /\b(ghp_[A-Za-z0-9]{36})\b/g,
    description: 'GitHub Personal Access Token detected. Provides access to GitHub repositories and APIs.',
    remediation: 'Revoke this token in GitHub Settings → Developer settings → Personal access tokens.',
  },
  {
    name: 'github_oauth_token',
    secretType: 'GitHub OAuth Token',
    severity: 'critical',
    regex: /\b(gho_[A-Za-z0-9]{36})\b/g,
    description: 'GitHub OAuth token detected.',
    remediation: 'Revoke this token in GitHub Settings → Developer settings → OAuth Apps.',
  },
  {
    name: 'github_app_token',
    secretType: 'GitHub App Token',
    severity: 'high',
    regex: /\b(ghs_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36})\b/g,
    description: 'GitHub App installation or user token detected.',
    remediation: 'Regenerate the token via your GitHub App settings.',
  },
  // ── Google ───────────────────────────────────────────────
  {
    name: 'google_api_key',
    secretType: 'Google API Key',
    severity: 'high',
    regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/g,
    description: 'Google API Key detected. May grant access to Google Cloud services.',
    remediation: 'Restrict the key in Google Cloud Console and regenerate a new one.',
  },
  {
    name: 'google_oauth_client_secret',
    secretType: 'Google OAuth Client Secret',
    severity: 'high',
    regex: /GOCSPX-[A-Za-z0-9\-_]{28}/g,
    description: 'Google OAuth Client Secret detected.',
    remediation: 'Regenerate the secret in Google Cloud Console → APIs & Services → Credentials.',
  },
  // ── Stripe ───────────────────────────────────────────────
  {
    name: 'stripe_secret_key',
    secretType: 'Stripe Secret Key',
    severity: 'critical',
    regex: /\b(sk_live_[A-Za-z0-9]{24,})\b/g,
    description: 'Stripe live secret key detected. Full access to your Stripe account.',
    remediation: 'Roll this key immediately in Stripe Dashboard → Developers → API Keys.',
  },
  {
    name: 'stripe_restricted_key',
    secretType: 'Stripe Restricted Key',
    severity: 'high',
    regex: /\b(rk_live_[A-Za-z0-9]{24,})\b/g,
    description: 'Stripe restricted live key detected.',
    remediation: 'Roll this key in Stripe Dashboard → Developers → API Keys.',
  },
  // ── Slack ────────────────────────────────────────────────
  {
    name: 'slack_bot_token',
    secretType: 'Slack Bot Token',
    severity: 'high',
    regex: /\b(xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{23,25})\b/g,
    description: 'Slack Bot Token detected. Can send messages and access workspace data.',
    remediation: 'Revoke in Slack API settings → Your Apps → OAuth & Permissions.',
  },
  {
    name: 'slack_user_token',
    secretType: 'Slack User Token',
    severity: 'high',
    regex: /\b(xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{32})\b/g,
    description: 'Slack User Token detected. Acts on behalf of a user.',
    remediation: 'Revoke in Slack API settings → Your Apps → OAuth & Permissions.',
  },
  {
    name: 'slack_webhook',
    secretType: 'Slack Webhook URL',
    severity: 'medium',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g,
    description: 'Slack Incoming Webhook URL detected. Anyone with this URL can post to your Slack channel.',
    remediation: 'Regenerate the webhook in Slack API settings → Incoming Webhooks.',
  },
  // ── OpenAI ───────────────────────────────────────────────
  {
    name: 'openai_api_key',
    secretType: 'OpenAI API Key',
    severity: 'critical',
    regex: /\b(sk-(?:proj-)?[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,})\b/g,
    description: 'OpenAI API key detected. Can be used to make API calls billed to your account.',
    remediation: 'Revoke in OpenAI Platform → API Keys and generate a new one.',
  },
  // ── Twilio ───────────────────────────────────────────────
  {
    name: 'twilio_account_sid',
    secretType: 'Twilio Account SID',
    severity: 'medium',
    regex: /\b(AC[a-f0-9]{32})\b/g,
    description: 'Twilio Account SID detected.',
    remediation: 'Rotate your Twilio Auth Token in the Twilio Console.',
  },
  {
    name: 'twilio_auth_token',
    secretType: 'Twilio Auth Token',
    severity: 'critical',
    regex: /(?:twilio[_\-\s]?auth[_\-\s]?token|auth[_\-\s]?token)\s*[=:]\s*['""]?([a-f0-9]{32})['""]?/gi,
    description: 'Twilio Auth Token detected. Full control over your Twilio account.',
    remediation: 'Rotate your Auth Token in the Twilio Console immediately.',
  },
  // ── Generic Secrets ──────────────────────────────────────
  {
    name: 'private_key',
    secretType: 'Private Key (PEM)',
    severity: 'critical',
    regex: /-----BEGIN\s(?:RSA\s|EC\s|DSA\s|OPENSSH\s)?PRIVATE KEY-----/g,
    description: 'PEM private key block detected.',
    remediation: 'Never commit private keys to code. Use a secrets manager or environment variables.',
  },
  {
    name: 'generic_secret',
    secretType: 'Generic Secret / Password',
    severity: 'medium',
    regex: /(?:password|passwd|pwd|secret|api[_-]?key|auth[_-]?token|access[_-]?token)\s*[=:]\s*['""]([^'""]{8,})['""](?!\s*#\s*(?:example|placeholder|your|changeme|todo))/gi,
    description: 'Hardcoded secret or password detected in source code.',
    remediation: 'Move secrets to environment variables or a secrets manager. Never hardcode credentials.',
  },
  {
    name: 'jwt_token',
    secretType: 'JSON Web Token',
    severity: 'medium',
    regex: /\b(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)\b/g,
    description: 'JWT token detected. May contain sensitive claims or grant session access.',
    remediation: 'Do not hardcode tokens. Ensure token expiry is set and tokens are stored securely.',
  },
  {
    name: 'sendgrid_api_key',
    secretType: 'SendGrid API Key',
    severity: 'high',
    regex: /\b(SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43})\b/g,
    description: 'SendGrid API Key detected. Can send emails from your account.',
    remediation: 'Revoke in SendGrid Settings → API Keys.',
  },
  {
    name: 'mailgun_api_key',
    secretType: 'Mailgun API Key',
    severity: 'high',
    regex: /\b(key-[a-f0-9]{32})\b/g,
    description: 'Mailgun API key detected.',
    remediation: 'Regenerate in Mailgun → Account → API Security.',
  },
  {
    name: 'firebase_api_key',
    secretType: 'Firebase API Key',
    severity: 'medium',
    regex: /(?:firebase[_\-\s]?api[_\-\s]?key|FIREBASE[_\-]API[_\-]KEY)\s*[=:]\s*['""]?([A-Za-z0-9\-_]{39})['""]?/gi,
    description: 'Firebase API key detected.',
    remediation: 'Restrict the key in Firebase Console → Project Settings → API Keys.',
  },
];
