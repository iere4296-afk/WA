/**
 * Offline fallback when both Groq and OpenAI are unavailable.
 * The templates are intentionally varied so opening-pattern checks do not
 * collapse into a single repeated sentence.
 */

const TEMPLATES: Array<[string, string, string]> = [
  ['Hi {{name}}', 'We have something special for you - {product}.', 'Tap to learn more.'],
  ['Hey {{name}}', '{product} is now available for {audience}.', 'Want details? Reply YES.'],
  ['{{name}}, exciting news', '{product} just launched for {audience}.', 'Reply if you want the full details.'],
  ['Quick update, {{name}}', 'We thought you would love {product}.', 'Reply INFO for details.'],
  ['Good news, {{name}}', '{product} is here for {audience}.', 'Let us know if you are interested.'],
  ['{{name}}, do not miss this', '{product} is available now for {audience}.', 'Reply for more information.'],
  ['Hello {{name}}', 'Wanted to personally share {product} with you.', 'Interested? Just say Yes.'],
  ['{{name}}, special offer inside', '{product} was prepared for {audience}.', 'Click to explore more.'],
]

function renderTemplate(template: [string, string, string], product: string, audience: string): string {
  const [opening, body, cta] = template

  return [opening, body, cta]
    .join(' ')
    .replace(/{product}/g, product)
    .replace(/{audience}/g, audience)
    .replace(/\s+/g, ' ')
    .trim()
}

export const handlebarsFallback = {
  generateVariants(params: {
    product: string
    audience: string
    tone: string
    count: number
  }): string[] {
    const { product, audience, count } = params
    const results: string[] = []

    for (let index = 0; index < Math.min(count, TEMPLATES.length); index += 1) {
      results.push(renderTemplate(TEMPLATES[index], product, audience))
    }

    while (results.length < count) {
      const template = TEMPLATES[results.length % TEMPLATES.length]
      const accent = ['Plus,', 'Also,', 'By the way,', 'Good fit if', 'Worth a look if'][results.length % 5]
      results.push(`${accent} ${renderTemplate(template, product, audience)}`.replace(/\s+/g, ' ').trim())
    }

    return results.slice(0, count)
  },
}
