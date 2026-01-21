/**
 * Parses fill in the blank questions in a markdown guide.
 *
 * Each guide can have one set of fill in the blank questions.
 * This set of question should be an ordered list where each item
 * is a question.
 *
 * Each question (item) must:
 * 1. include ___ (in the place where the blank should be filled)
 * 2. end with " (answer)"  (the space and the parenthesis are needed)
 */
export function remarkFillInTheBlank(options) {
  return function (tree) {
    console.log(tree)
    console.log("OJO options=", options)
    let l = tree.children
    let n = []
    globalThis.fillInTheBlank = []
    for (let i = 0; i < l.length; i++) {
      const re = /^(.*___.*)\s+\((.*)\)\s*$/s
      let rm = ''
      if (
        l[i].type == 'list' &&
        l[i].ordered &&
        l[i].children.length > 0 &&
        l[i].children[0].type == 'listItem' &&
        l[i].children[0].children.length > 0 &&
        l[i].children[0].children[0].type == 'paragraph' &&
        l[i].children[0].children[0].children.length > 0 &&
        l[i].children[0].children[0].children[0].type == 'text' &&
        (rm = l[i].children[0].children[0].children[0].value.match(re))
      ) {
        console.log('** skippping')
        console.log(rm)
        let list = l[i].children
        console.log('list.length=', list.length)
        for (let j = 0; j < list.length; j++) {
          console.log('list[j]=', list[j])
          console.log(
            'list[j].children[0].children[0]=',
            list[j].children[0].children[0],
          )
          if (
            list[j].type == 'listItem' &&
            list[j].children.length > 0 &&
            list[j].children[0].type == 'paragraph' &&
            list[j].children[0].children.length > 0 &&
            list[j].children[0].children[0].type == 'text'
          ) {
            rm = list[j].children[0].children[0].value.match(re)
            console.log('rm=', rm)
            if (rm) {
              globalThis.fillInTheBlank.push({
                clue: rm[1],
                answer: rm[2],
              })
            }
          }
        }
        n.push({
          type: 'paragraph',
          children: [
            {
              type: 'html',

              value:
                '<a class="rounded-md text-sm font-medium bg-primary text-primary-foreground! hover:bg-primary/90  h-9 px-4 py-2" href="' +
                (options['url'] || '') +
                '">',

              position: {
                start: l[i].position.start,
                end: l[i].position.start,
              },
            },
            {
              type: 'text',
              value: options['lang'] == 'es' ? 'Resolver un juego' : 'Solve a puzzle',
              position: { start: l[i].position.start, end: l[i].position.end },
            },
            {
              type: 'html',
              value: '</a>',
              position: { start: l[i].position.end, end: l[i].position.end },
            },
            {
              type: 'text',
              value: options['lang'] == 'es' ? 
              ' para probar tu comprensión y ganar USDT si eres elegible' :
              ' to test your understanding and earn cryptocurrency if eligible',
              position: { start: l[i].position.start, end: l[i].position.end },
            },
          ],
        })
        console.log('globalThis.fillInTheBlank=', globalThis.fillInTheBlank)
      } else {
        console.log('** pushing ', l[i].type)

        if (l[i].type == 'paragraph') {
          console.log('<p> children', l[i].children)
        }
        n.push(l[i])
      }
    }
    console.log(n)
    tree.children = n
    return tree
  }
}
