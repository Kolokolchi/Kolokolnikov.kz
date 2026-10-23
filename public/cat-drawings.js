// Original vector companion. Each half is rooted behind the same element edge;
// the placement module supplies its orientation and the element masks the body.
const poses = {
  top: { tilt: -2, gazeX: 3, gazeY: -1, tail: 'right' },
  bottom: { tilt: 3, gazeX: -3, gazeY: 2, tail: 'left' },
  left: { tilt: -4, gazeX: 4, gazeY: 1, tail: 'left' },
  right: { tilt: 4, gazeX: -4, gazeY: -1, tail: 'right' },
};

function poseFor(side) {
  return poses[side] || poses.top;
}

export function catHeadDrawing(side = 'top') {
  const { tilt, gazeX, gazeY } = poseFor(side);
  return `<svg class="scroll-cat__drawing scroll-cat__drawing--head" viewBox="0 0 160 112" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <g transform="rotate(${tilt} 80 88)" stroke-linecap="round" stroke-linejoin="round">
      <g fill="var(--cat-fur, #121c27)" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.7">
        <path d="M30 48C29 34 30 17 37 7C40 2 46 5 53 11L69 29C77 28 86 28 94 30L108 13C115 5 122 2 125 9C132 23 131 38 131 50C139 66 137 85 126 98C105 105 54 105 34 98C22 85 21 65 30 48Z"/>
        <path d="m29 73-16-3m17 12-17 1m19 6-15 6m113-22 17-3m-18 12 18 1m-20 6 15 6" stroke-width="3.3"/>
      </g>
      <g fill="#eef6fa">
        <path d="M38 30C38 23 39 17 42 13C48 16 54 22 59 28L53 28C49 24 46 21 43 20L42 32Z"/>
        <path d="M102 29C107 23 113 16 119 13C122 17 123 24 123 31L119 33C119 27 118 23 117 20C113 23 110 26 107 30Z"/>
        <ellipse cx="59" cy="63" rx="18.5" ry="22.5" transform="rotate(-7 59 63)"/>
        <ellipse cx="102" cy="63" rx="18.5" ry="22.5" transform="rotate(7 102 63)"/>
      </g>
      <g fill="var(--cat-fur, #121c27)">
        <ellipse cx="${62 + gazeX}" cy="${66 + gazeY}" rx="7.2" ry="10.5"/>
        <ellipse cx="${99 + gazeX}" cy="${66 + gazeY}" rx="7.2" ry="10.5"/>
      </g>
      <g fill="#eef6fa">
        <ellipse cx="${64 + gazeX}" cy="${62 + gazeY}" rx="2" ry="3.2"/>
        <ellipse cx="${101 + gazeX}" cy="${62 + gazeY}" rx="2" ry="3.2"/>
        <path d="M75 78C76 75 85 75 87 78C89 81 84 86 81 86C78 86 73 81 75 78Z"/>
      </g>
      <path d="M81 86v3m0 0c-3 4-7 4-9 1m9-1c3 4 7 4 9 1" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.4"/>
      <g fill="var(--cat-fur, #121c27)" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.7">
        <path d="M34 89C28 93 28 103 33 108C36 111 40 110 42 107C44 113 50 113 53 108C57 112 63 108 63 102L61 91"/>
        <path d="M100 91L98 102C98 108 104 112 108 108C111 113 117 113 119 107C121 110 125 111 128 108C133 103 133 93 127 89"/>
      </g>
      <path d="m42 100 1 6m9-5 1 6m56-6-1 6m10-7-1 6" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".4" stroke-width="1.1"/>
    </g>
  </svg>`;
}

export function catTailDrawing(side = 'top') {
  const { tail } = poseFor(side);
  const curl = tail === 'left'
    ? 'M74 33C80 54 73 63 56 76C37 91 37 106 51 116C65 126 83 119 83 105C83 93 67 91 68 81C70 68 94 55 90 34Z'
    : 'M67 34C61 54 69 63 85 77C103 92 103 108 88 118C73 127 55 119 57 105C59 92 74 92 73 81C72 68 49 55 53 34Z';
  return `<svg class="scroll-cat__drawing scroll-cat__drawing--tail" viewBox="0 0 140 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <g stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="var(--cat-fur, #121c27)">
      <path d="${curl}"/>
      <path d="M24-8C25 8 30 27 42 36C52 44 63 43 70 37C78 44 91 45 102 36C115 25 118 8 117-8Z"/>
      <path d="M28-5C21-4 14 2 13 9C12 17 19 25 28 26C35 28 42 25 42 18C42 10 34-3 28-5Z"/>
      <path d="M113-5C120-4 127 2 128 9C129 17 122 25 113 26C106 28 99 25 99 18C99 10 107-3 113-5Z"/>
    </g>
    <g fill="#eef6fa">
      <ellipse cx="28" cy="17" rx="5.5" ry="6.3" transform="rotate(-30 28 17)"/>
      <ellipse cx="20" cy="8" rx="2.8" ry="3.4" transform="rotate(-35 20 8)"/>
      <ellipse cx="26" cy="3" rx="2.8" ry="3.4" transform="rotate(-20 26 3)"/>
      <ellipse cx="33" cy="5" rx="2.7" ry="3.3" transform="rotate(-23 33 5)"/>
      <ellipse cx="113" cy="17" rx="5.5" ry="6.3" transform="rotate(30 113 17)"/>
      <ellipse cx="121" cy="8" rx="2.8" ry="3.4" transform="rotate(35 121 8)"/>
      <ellipse cx="115" cy="3" rx="2.8" ry="3.4" transform="rotate(20 115 3)"/>
      <ellipse cx="108" cy="5" rx="2.7" ry="3.3" transform="rotate(23 108 5)"/>
    </g>
  </svg>`;
}

// The same companion stretching through open space, with no supporting border.
export function catSlidingDrawing() {
  return `<svg class="scroll-cat__drawing scroll-cat__drawing--sliding" viewBox="0 0 160 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <g stroke-linecap="round" stroke-linejoin="round">
      <g fill="var(--cat-fur, #121c27)" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.7">
        <path d="M85 229C82 248 91 258 108 265C126 272 127 283 116 288C107 292 99 284 103 277C105 273 100 269 96 273C83 286 99 302 116 296C138 289 138 271 118 259C102 250 105 237 104 229Z"/>
        <path d="M57 220C44 226 35 241 35 254C35 262 42 266 48 263L63 251C69 246 73 237 74 229Z"/>
        <path d="M87 225C92 238 103 246 111 251C117 256 119 265 112 270C105 274 98 269 93 262L76 241Z"/>
        <path d="M52 147C43 161 43 180 46 199L49 222C52 243 70 251 85 245C104 249 116 233 114 215L111 181C110 164 104 152 98 145Z"/>
        <path d="M49 163C30 147 19 119 19 95L20 30C14 24 16 15 20 14C18 5 25 3 29 7C32 0 39 4 39 10C45 8 49 14 47 21L42 88C41 107 47 123 63 137L67 157Z"/>
        <path d="M99 156C118 141 123 118 122 96L116 25C113 17 116 12 122 12C120 5 126 2 130 7C134 1 140 5 139 12C147 10 149 18 144 24L146 88C149 118 139 145 117 166Z"/>
      </g>
      <path d="m25 15 1 12m9-13 1 13m89-8 1 11m10-12 1 11m-90 219 4-4m53 18 3 4" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".4" stroke-width="1.3"/>
      <g transform="translate(0 70)">
        <g fill="var(--cat-fur, #121c27)" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.7">
          <path d="M30 48C29 34 30 17 37 7C40 2 46 5 53 11L69 29C77 28 86 28 94 30L108 13C115 5 122 2 125 9C132 23 131 38 131 50C139 66 137 85 126 98C105 105 54 105 34 98C22 85 21 65 30 48Z"/>
          <path d="m29 73-16-3m17 12-17 1m19 6-15 6m113-22 17-3m-18 12 18 1m-20 6 15 6" stroke-width="3.3"/>
        </g>
        <g fill="#eef6fa">
          <path d="M38 30C38 23 39 17 42 13C48 16 54 22 59 28L53 28C49 24 46 21 43 20L42 32Z"/>
          <path d="M102 29C107 23 113 16 119 13C122 17 123 24 123 31L119 33C119 27 118 23 117 20C113 23 110 26 107 30Z"/>
          <ellipse cx="59" cy="63" rx="18.5" ry="22.5" transform="rotate(-7 59 63)"/>
          <ellipse cx="102" cy="63" rx="18.5" ry="22.5" transform="rotate(7 102 63)"/>
        </g>
        <g fill="var(--cat-fur, #121c27)">
          <ellipse cx="63" cy="62" rx="7.2" ry="10.5"/>
          <ellipse cx="100" cy="62" rx="7.2" ry="10.5"/>
        </g>
        <g fill="#eef6fa">
          <ellipse cx="65" cy="58" rx="2" ry="3.2"/>
          <ellipse cx="102" cy="58" rx="2" ry="3.2"/>
          <path d="M75 78C76 75 85 75 87 78C89 81 84 86 81 86C78 86 73 81 75 78Z"/>
        </g>
        <path d="M81 86v3m0 0c-3 4-7 4-9 1m9-1c3 4 7 4 9 1" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.4"/>
      </g>
    </g>
  </svg>`;
}

// A relaxed border pose in the same proportions and palette as the peeking cat.
export function catLoungeDrawing(side = 'top') {
  const { tilt, gazeX, gazeY } = poseFor(side);
  return `<svg class="scroll-cat__drawing scroll-cat__drawing--lounge" viewBox="0 0 260 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <g stroke-linecap="round" stroke-linejoin="round">
      <g fill="var(--cat-fur, #121c27)" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.7">
        <path d="M205 65C221 55 223 43 221 29C219 16 226 5 237 5C249 4 258 13 253 24C250 33 240 36 234 30C230 26 234 21 238 24C244 28 249 21 245 17C237 9 232 20 236 31C241 46 234 67 220 77Z"/>
        <path d="M99 64C99 79 107 91 106 107C106 115 109 121 102 124C95 127 89 122 90 115L84 84L82 67Z"/>
        <path d="M192 65C198 79 193 89 196 103C199 111 199 118 192 121C185 123 178 119 180 111L176 83L175 66Z"/>
        <path d="M81 55C103 43 137 39 169 42C191 42 206 47 216 59C228 73 214 84 198 82L100 81C85 80 76 68 81 55Z"/>
      </g>
      <path d="m96 116 1 6m92-8 1 6" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".4" stroke-width="1.3"/>
      <g transform="translate(0 2) scale(.72)">
        <g transform="rotate(${tilt / 2} 80 88)">
          <g fill="var(--cat-fur, #121c27)" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="2">
            <path d="M30 48C29 34 30 17 37 7C40 2 46 5 53 11L69 29C77 28 86 28 94 30L108 13C115 5 122 2 125 9C132 23 131 38 131 50C139 66 137 85 126 98C105 105 54 105 34 98C22 85 21 65 30 48Z"/>
            <path d="m29 73-16-3m17 12-17 1m19 6-15 6m113-22 17-3m-18 12 18 1m-20 6 15 6" stroke-width="3.3"/>
          </g>
          <g fill="#eef6fa">
            <path d="M38 30C38 23 39 17 42 13C48 16 54 22 59 28L53 28C49 24 46 21 43 20L42 32Z"/>
            <path d="M102 29C107 23 113 16 119 13C122 17 123 24 123 31L119 33C119 27 118 23 117 20C113 23 110 26 107 30Z"/>
            <ellipse cx="59" cy="63" rx="18.5" ry="22.5" transform="rotate(-7 59 63)"/>
            <ellipse cx="102" cy="63" rx="18.5" ry="22.5" transform="rotate(7 102 63)"/>
          </g>
          <g fill="var(--cat-fur, #121c27)">
            <ellipse cx="${62 + gazeX}" cy="${66 + gazeY}" rx="7.2" ry="10.5"/>
            <ellipse cx="${99 + gazeX}" cy="${66 + gazeY}" rx="7.2" ry="10.5"/>
          </g>
          <g fill="#eef6fa">
            <ellipse cx="${64 + gazeX}" cy="${62 + gazeY}" rx="2" ry="3.2"/>
            <ellipse cx="${101 + gazeX}" cy="${62 + gazeY}" rx="2" ry="3.2"/>
            <path d="M75 78C76 75 85 75 87 78C89 81 84 86 81 86C78 86 73 81 75 78Z"/>
          </g>
          <path d="M81 86v3m0 0c-3 4-7 4-9 1m9-1c3 4 7 4 9 1" stroke="var(--cat-outline, #a9c4d6)" stroke-opacity=".8" stroke-width="1.7"/>
        </g>
      </g>
    </g>
  </svg>`;
}
