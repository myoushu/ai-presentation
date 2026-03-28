(function () {
  'use strict';

  const CHAR_SIZE = 14;
  const FALL_SPEED_MIN = 0.5;
  const FALL_SPEED_MAX = 1.5;
  const FADE_ALPHA = 0.05;
  const MATRIX_GREEN = '#00ff41';
  const BRIGHT_GREEN = '#80ff80';

  // Katakana + latin + digits
  const CHARS =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  let canvas, ctx;
  let columns = [];
  let animationId = null;
  let running = false;

  function randomChar() {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  function createCanvas() {
    canvas = document.createElement('canvas');
    canvas.id = 'matrix-rain-canvas';
    canvas.style.opacity = '1';
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initColumns();
  }

  function initColumns() {
    var count = Math.floor(canvas.width / CHAR_SIZE);
    columns = [];
    for (var i = 0; i < count; i++) {
      columns.push({
        x: i * CHAR_SIZE,
        y: Math.random() * canvas.height,
        speed: FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
      });
    }
  }

  function draw() {
    // Semi-transparent black overlay for fade trail
    ctx.fillStyle = 'rgba(0, 0, 0, ' + FADE_ALPHA + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = CHAR_SIZE + 'px monospace';

    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];

      // Head character is brighter
      ctx.fillStyle = BRIGHT_GREEN;
      ctx.fillText(randomChar(), col.x, col.y);

      // Move down
      col.y += col.speed * CHAR_SIZE;

      // Reset with random chance when off screen
      if (col.y > canvas.height && Math.random() > 0.975) {
        col.y = 0;
        col.speed = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN);
      }
    }

    // Occasional dim characters for depth
    ctx.fillStyle = MATRIX_GREEN;
    for (var j = 0; j < columns.length; j++) {
      if (Math.random() > 0.98) {
        var ry = Math.random() * canvas.height;
        ctx.globalAlpha = 0.3 + Math.random() * 0.4;
        ctx.fillText(randomChar(), columns[j].x, ry);
        ctx.globalAlpha = 1.0;
      }
    }

    if (running) {
      animationId = requestAnimationFrame(draw);
    }
  }

  function start() {
    if (running) return;
    if (!canvas) createCanvas();
    running = true;
    // Fill canvas black initially
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    animationId = requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function destroy() {
    stop();
    if (canvas && canvas.parentNode) {
      window.removeEventListener('resize', resize);
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
    ctx = null;
  }

  window.MatrixRain = {
    start: start,
    stop: stop,
    destroy: destroy
  };
})();
