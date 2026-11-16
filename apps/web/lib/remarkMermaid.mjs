/**
 * Mermaid diagrams written **inside** the guide.
 *
 * A fenced block whose info string is `mermaid` is the source of the diagram:
 *
 *   ```mermaid
 *   flowchart LR
 *     A[Church] --> B[Cluster]
 *   ```
 *
 * The plugin does not render anything at request time: it replaces the fence
 * with a normal markdown `image` node that points at the SVG generated offline
 * by `bin/mmd2svg.mjs --scan` (see doc/guide-writing.md § Diagrams). That keeps
 * three properties the guides need:
 *
 * - the source lives in the guide, next to the text that explains it;
 * - the page pays no Mermaid runtime (flowcharts take seconds and `mermaid` is
 *   tens of megabytes, while this HTML is also built in the browser);
 * - it survives `allowDangerousHtml: false` (the course page renders with it)
 *   and `guideImageUrls` caches the `<img>` for offline reading.
 *
 * The file name is a hash of the source, so the same source always maps to the
 * same SVG and `--scan` prunes what no longer exists.
 */

export const MERMAID_IMAGE_DIR = '/img/diagrams'

/** Fence info string: `mermaid`, optionally followed by the alt text. */
const FENCE = /^```+[ \t]*mermaid[ \t]*(.*)$/

/** Same bytes for the plugin and for `bin/mmd2svg.mjs --scan`. */
export function normalizeMermaidSource(source) {
  return String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim()
}

/**
 * Two FNV-1a passes with different offsets: 16 hex chars, no `node:crypto`
 * (this module also runs in the browser bundle). A collision would mean two
 * different diagrams sharing one SVG, which the scan would make visible.
 */
export function diagramId(source) {
  const text = normalizeMermaidSource(source)
  const hash = (basis) => {
    let value = basis
    for (let i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i)
      value = Math.imul(value, 0x01000193) >>> 0
    }
    return value.toString(16).padStart(8, '0')
  }
  return hash(0x811c9dc5) + hash(0x7fffffff)
}

export function diagramUrl(source) {
  return `${MERMAID_IMAGE_DIR}/${diagramId(source)}.svg`
}

/**
 * Diagrams of one markdown document, in reading order.
 *
 * @param {string} markdown
 * @returns {{ id: string, source: string, alt: string, line: number }[]}
 */
export function extractMermaidDiagrams(markdown) {
  const diagrams = []
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const opening = FENCE.exec(lines[i])
    if (!opening) continue
    const body = []
    let j = i + 1
    for (; j < lines.length; j++) {
      if (/^```+\s*$/.test(lines[j])) break
      body.push(lines[j])
    }
    const source = normalizeMermaidSource(body.join('\n'))
    if (source) {
      diagrams.push({
        id: diagramId(source),
        source,
        alt: (opening[1] || '').trim(),
        line: i + 1,
      })
    }
    i = j
  }
  return diagrams
}

function headingText(node) {
  if (!node || !Array.isArray(node.children)) return ''
  return node.children
    .map((child) => (child && typeof child.value === 'string' ? child.value : ''))
    .join('')
    .trim()
}

function replaceFences(nodes, fallbackAlt) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === 'code' && node.lang === 'mermaid') {
      const source = normalizeMermaidSource(node.value)
      if (!source) {
        nodes.splice(i, 1)
        i--
        continue
      }
      const alt = (node.meta || '').trim() || nearestHeading(nodes, i) || fallbackAlt
      nodes[i] = {
        type: 'image',
        url: diagramUrl(source),
        alt,
        title: null,
        position: node.position,
      }
      continue
    }
    if (Array.isArray(node.children)) {
      replaceFences(node.children, fallbackAlt)
    }
  }
  return nodes
}

function nearestHeading(nodes, index) {
  for (let i = index - 1; i >= 0; i--) {
    if (nodes[i].type === 'heading') {
      const text = headingText(nodes[i])
      if (text) return text
    }
  }
  return ''
}

/**
 * @param {{ alt?: string }} [options]
 */
export function remarkMermaid(options = {}) {
  const fallbackAlt = options.alt || 'Diagram'
  return function (tree) {
    replaceFences(tree.children, fallbackAlt)
    return tree
  }
}
