/*
BSD 3-Clause License

Copyright (c) 2024, freeCodeCamp. All rights reserved.

  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

  Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
// Ported to ESM from
// https://github.com/freecodecamp/FreeCodeCamp/blob/staging/tools/challenge-parser/parser/plugins/add-fill-in-the-blank.js

import { root } from 'mdast-builder';
import { find }  from 'unist-util-find';
import { visit } from 'unist-util-visit';
import getAllBetween from './between-headings';
import getAllBefore from './before-heading';
import mdastToHtml from './mdast-to-html';

import splitOnThematicBreak from './split-on-thematic-break';

const NOT_IN_PARAGRAPHS = `Each inline code block in the fillInTheBlank sentence section must in its own paragraph
If you have more than one code block, check that they're separated by a blank line
Example of bad formatting:
\`too close\`
\`to each other\`

Example of good formatting:
\`separated\`

\`by a blank line\`

`;

const NOT_IN_CODE_BLOCK = `Each paragraph in the fillInTheBlank sentence section must be inside an inline code block
Example of bad formatting:
## --sentence--

This is a sentence

Example of good formatting:
## --sentence--

\`This is a sentence\`

`;

function plugin() {
  return transformer;
  function transformer(tree, file) {
    debugger
    const fillInTheBlankNodes = getAllBetween(tree, '--fillInTheBlank--');
    if (fillInTheBlankNodes.length > 0) {
      const fillInTheBlankTree = root(fillInTheBlankNodes);

      validateBlanksCount(fillInTheBlankTree);

      const sentenceNodes = getAllBetween(fillInTheBlankTree, '--sentence--');
      const blanksNodes = getAllBetween(fillInTheBlankTree, '--blanks--');

      const fillInTheBlank = getfillInTheBlank(sentenceNodes, blanksNodes);

      file.data.fillInTheBlank = fillInTheBlank;
    }
  }
}

function validateBlanksCount(fillInTheBlankTree) {
  let blanksCount = 0;
  visit(fillInTheBlankTree, { value: '--blanks--' }, () => {
    blanksCount++;
  });

  if (blanksCount !== 1)
    throw Error(
      `There should only be one --blanks-- section in the fillInTheBlank challenge`
    );
}

function getfillInTheBlank(sentenceNodes, blanksNodes) {
  const sentenceWithoutCodeBlocks = sentenceNodes.map(node => {
    node.children.forEach(child => {
      if (child.type === 'text' && child.value.trim() === '')
        throw Error(NOT_IN_PARAGRAPHS);
      if (child.type !== 'inlineCode') throw Error(NOT_IN_CODE_BLOCK);
    });

    const children = node.children.map(child => ({ ...child, type: 'text' }));
    return { ...node, children };
  });
  const sentence = mdastToHtml(sentenceWithoutCodeBlocks);
  const blanks = getBlanks(blanksNodes);

  if (!sentence) throw Error('sentence is missing from fill in the blank');
  if (!blanks) throw Error('blanks are missing from fill in the blank');
  if (sentence.match(/_/g).length !== blanks.length)
    throw Error(
      `Number of underscores in sentence doesn't match the number of blanks`
    );

  return { sentence, blanks };
}

function getBlanks(blanksNodes) {
  const blanksGroups = splitOnThematicBreak(blanksNodes);

  return blanksGroups.map(blanksGroup => {
    const blanksTree = root(blanksGroup);
    const feedback = find(blanksTree, { value: '--feedback--' });

    if (feedback) {
      const blanksNodes = getAllBefore(blanksTree, '--feedback--');
      const feedbackNodes = getAllBetween(blanksTree, '--feedback--');

      return {
        answer: blanksNodes[0].children[0].value,
        feedback: mdastToHtml(feedbackNodes)
      };
    }

    return { answer: blanksGroup[0].children[0].value, feedback: null };
  });
}

export default plugin;
