// One original vector character, shared by the peeking, lounging and falling poses.
// Support coordinates are fixed: head y96, opposite paws y0, lounge y78.
const FUR = 'var(--cat-fur, #121c27)';
const OUTLINE = 'var(--cat-outline, #a9c4d6)';
const WHITE = '#eef6fa';
const poses = {
  top: { tilt: -2, gazeX: 2, gazeY: -1, tail: 'right' },
  bottom: { tilt: 2, gazeX: -2, gazeY: 1, tail: 'left' },
  left: { tilt: -3, gazeX: 3, gazeY: 0, tail: 'left' },
  right: { tilt: 3, gazeX: -3, gazeY: 0, tail: 'right' },
};

const HEAD = 'M30 44C27 30 29 14 35 7C39 2 45 5 54 14L68 28Q80 25 92 28L107 13C115 5 122 2 126 8C132 19 132 32 130 45C138 54 141 66 137 79C133 96 112 105 80 105C48 105 28 97 23 81C19 66 22 53 30 44Z';
// The open chin joins the full-body pose without drawing a seam across its neck.
const JOINED_HEAD_EDGE = 'M62 104C43 102 28 97 23 81C19 66 22 53 30 44C27 30 29 14 35 7C39 2 45 5 54 14L68 28Q80 25 92 28L107 13C115 5 122 2 126 8C132 19 132 32 130 45C138 54 141 66 137 79C133 96 115 103 98 104';

function poseFor(side) {
  return poses[side] || poses.top;
}

function svg(kind, viewBox, content) {
  return `<svg class="scroll-cat__drawing scroll-cat__drawing--${kind}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;
}

function shape(d, width = 1.6) {
  return `<path d="${d}" fill="${FUR}" stroke="${OUTLINE}" stroke-opacity=".64" stroke-width="${width}"/>`;
}

function line(d, width = 1.5, opacity = .6) {
  return `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-opacity="${opacity}" stroke-width="${width}"/>`;
}

function head({ tilt = 0, gazeX = 0, gazeY = 0, joined = false } = {}) {
  return `<g transform="rotate(${tilt} 80 74)">
    <path d="${HEAD}" fill="${FUR}"/>
    ${line(joined ? JOINED_HEAD_EDGE : HEAD, 1.6, .64)}
    <path d="M38 29C38 23 39 18 41 15Q48 20 55 29M105 29Q112 20 119 15C122 20 123 25 122 30" stroke="${WHITE}" stroke-opacity=".84" stroke-width="3.6"/>
    <g fill="${WHITE}">
      <ellipse cx="58" cy="63" rx="18.5" ry="22.5" transform="rotate(-7 58 63)"/>
      <ellipse cx="102" cy="63" rx="18.5" ry="22.5" transform="rotate(7 102 63)"/>
    </g>
    <g fill="${FUR}">
      <ellipse cx="${62 + gazeX}" cy="${65 + gazeY}" rx="6.8" ry="10.2"/>
      <ellipse cx="${98 + gazeX}" cy="${65 + gazeY}" rx="6.8" ry="10.2"/>
    </g>
    <g fill="${WHITE}">
      <ellipse cx="${64 + gazeX}" cy="${61 + gazeY}" rx="1.9" ry="2.9"/>
      <ellipse cx="${100 + gazeX}" cy="${61 + gazeY}" rx="1.9" ry="2.9"/>
      <path d="M75 80C76 77 84 77 85 80C87 83 83 87 80 87C77 87 73 83 75 80Z"/>
    </g>
    ${line('M80 87v3m0 0c-3 3-6 3-8 0m8 0c3 3 6 3 8 0', 1.3, .57)}
    ${line('m27 72-14-3m14 12-15 2m121-11 14-3m-14 12 15 2', 2, .61)}
  </g>`;
}

function frontPaws() {
  const paw = `${shape('M34 88C34 84 40 81 47 82C54 81 60 84 61 88L62 90C63 94 59 96 55 96Q52 96 51 93Q49 96 45 96Q41 96 40 93C39 95 37 96 35 96C31 96 30 92 33 88Z')}${line('m41 89 1 4m9-4 1 4', 1.2, .34)}`;
  return `<g>${paw}</g><g transform="translate(160 0) scale(-1 1)">${paw}</g>`;
}

function backPaw(x, tilt) {
  return `<g transform="translate(${x} 16) rotate(${tilt})">
    <ellipse rx="11" ry="15" fill="${FUR}" stroke="${OUTLINE}" stroke-opacity=".64" stroke-width="1.6"/>
    <g fill="${WHITE}"><ellipse cy="4" rx="4.5" ry="5.4"/><ellipse cx="-5.5" cy="-5.8" rx="2.5" ry="3"/><ellipse cy="-9" rx="2.5" ry="3"/><ellipse cx="5.5" cy="-5.8" rx="2.5" ry="3"/></g>
  </g>`;
}

export function catHeadDrawing(side = 'top', variant = 'paired') {
  const pose = poseFor(side);
  const peek = variant === 'peek';
  const facing = pose.tilt < 0 ? -1 : 1;
  return svg('head', '0 0 160 112', `${head({ ...pose, tilt: pose.tilt + (peek ? facing * 3 : 0), gazeX: pose.gazeX + (peek ? facing : 0) })}${frontPaws()}`);
}

export function catTailDrawing(side = 'top') {
  const mirror = poseFor(side).tail === 'left';
  const tail = shape('M74 34C80 55 49 63 47 85C45 104 60 122 76 120C90 119 96 106 87 100C83 97 78 99 79 104C82 112 72 115 66 108C53 94 85 80 88 60C90 48 87 39 85 34Z');
  return svg('tail', '0 0 140 128', `<g${mirror ? ' transform="translate(140 0) scale(-1 1)"' : ''}>${tail}</g>${shape('M26-12C25 4 28 20 39 31C48 42 59 43 70 37C80 43 94 42 104 32C116 20 117 4 114-12Z')}${backPaw(28, -30)}${backPaw(112, 30)}`);
}

export function catSlidingDrawing() {
  const tail = shape('M78 232C80 252 53 254 47 270C40 289 65 300 89 295C112 290 127 275 120 262C116 254 107 255 105 261C102 268 112 271 109 277C102 291 68 293 60 282C51 269 92 267 95 243L95 233Z');
  // Forelegs, body and loose hind paws share one contour; only the head overlaps.
  const body = shape('M53 94C47 78 43 63 44 48L43 32C38 29 36 22 40 19C38 11 45 9 48 14C52 9 58 11 58 17C64 16 67 22 62 27L65 46C67 62 72 72 80 82C88 72 94 62 96 46L97 27C92 22 95 16 101 17C101 10 107 9 111 14C116 9 123 11 121 19C125 22 123 29 118 32L117 48C118 65 112 81 107 95C104 105 107 123 113 143C119 161 117 180 112 196C115 197 120 192 122 184C121 177 126 174 130 178C134 174 139 177 138 183C144 182 146 188 141 192C136 210 129 224 116 231C108 242 95 248 80 248C64 248 52 242 44 231C31 224 24 210 19 192C14 188 16 182 22 183C21 177 26 174 30 178C34 174 39 177 38 184C40 192 45 197 48 196C43 180 41 162 47 143C53 123 56 105 53 94Z');
  return svg('sliding', '0 0 160 300', `${tail}${body}${line('m48 24 2 7m8-8 1 6m44-6-1 6m10-5-2 7m-82 153 3 5m102-5-3 5', 1.15, .34)}<g transform="translate(10 42) scale(.875)">${head({ tilt: -2, gazeX: 0, gazeY: -4, joined: true })}</g>`);
}

export function catLoungeDrawing(side = 'top') {
  const pose = poseFor(side);
  const tail = shape('M205 65C220 58 225 45 223 30C221 17 226 7 236 6C247 4 255 12 254 21C253 31 243 36 236 30C232 27 234 22 238 24C244 28 250 22 246 17C239 9 232 18 236 31C241 47 234 66 220 77Z');
  const legs = `${shape('M91 69C90 82 99 94 98 109C98 115 101 122 96 125C90 128 85 124 86 116L79 83L78 70Z')}${shape('M188 69C190 82 184 89 186 102C188 110 190 118 184 121C179 124 173 120 174 113L169 85L173 70Z')}`;
  const body = shape('M79 58C103 45 135 39 165 44C190 45 210 49 220 64C227 75 216 83 199 81L96 80C82 80 74 69 79 58Z');
  return svg('lounge', '0 0 260 130', `${tail}${legs}${body}${line('m91 118 1 6m87-11 1 6', 1.15, .34)}<g transform="translate(0 7) scale(.68)">${head({ ...pose, tilt: pose.tilt / 2 })}</g>`);
}
