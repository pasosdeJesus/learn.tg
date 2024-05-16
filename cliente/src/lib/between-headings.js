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
// https://github.com/vtamara/FreeCodeCamp/blob/staging/tools/challenge-parser/parser/plugins/utils/between-headings.js

import { find } from 'unist-util-find';
import { findAfter } from 'unist-util-find-after';
import { findAllAfter } from 'unist-util-find-all-after';
import findAllBetween from 'unist-util-find-all-between';

function getAllBetween(tree, marker) {
  const start = find(tree, {
    type: 'heading',
    children: [
      {
        type: 'text',
        value: marker
      }
    ]
  });

  if (!start) return [];

  const isEnd = node => {
    return (
      node.type === 'heading' && node.depth <= start.depth && isMarker(node)
    );
  };

  const isMarker = node => {
    if (node.children && node.children[0]) {
      const child = node.children[0];
      return (
        child.type === 'text' &&
        child.value.startsWith('--') &&
        child.value.endsWith('--')
      );
    } else {
      return false;
    }
  };

  const end = findAfter(tree, start, isEnd);

  const targetNodes = end
    ? findAllBetween(tree, start, end)
    : findAllAfter(tree, start);
  return targetNodes;
}

export default getAllBetween;
