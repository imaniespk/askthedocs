type Plan = {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlight: boolean
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for personal projects and trying out AskTheDocs.',
    features: [
      'Up to 5 documents',
      '50 questions per month',
      'PDF and TXT support',
      'Basic chat interface',
    ],
    cta: 'Get started',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: 'per month',
    description: 'For power users who need more capacity and advanced features.',
    features: [
      'Unlimited documents',
      'Unlimited questions',
      'PDF, DOCX, and TXT support',
      'Conversation history',
      'Document preview panel',
      'Priority processing',
    ],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'For teams and organizations with advanced security and scale needs.',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'SSO / SAML authentication',
      'Dedicated infrastructure',
      'SLA guarantee',
      'Priority support',
    ],
    cta: 'Contact sales',
    highlight: false,
  },
]

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h1>
        <p className="text-gray-500">Choose the plan that fits your needs. No hidden fees.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map(plan => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.highlight
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most popular
              </span>
            )}

            <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-indigo-600'}`}>
              {plan.name}
            </p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-3xl font-bold">{plan.price}</span>
              {plan.price !== 'Custom' && (
                <span className={`text-sm mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-gray-400'}`}>
                  /{plan.period}
                </span>
              )}
            </div>
            {plan.price === 'Custom' && (
              <span className={`text-sm ${plan.highlight ? 'text-indigo-200' : 'text-gray-400'}`}>{plan.period}</span>
            )}
            <p className={`text-sm mt-2 mb-5 ${plan.highlight ? 'text-indigo-100' : 'text-gray-500'}`}>
              {plan.description}
            </p>

            <ul className="space-y-2.5 mb-7 flex-1">
              {plan.features.map(f => (
                <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? 'text-white' : 'text-gray-700'}`}>
                  <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-indigo-200' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                plan.highlight
                  ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-gray-400">
        All plans include a 14-day free trial. No credit card required to start.
      </p>
    </div>
  )
}
