(function () {
  'use strict';

  // === CONFIGURATION ===
  var GRID_COLS = 8;
  var GRID_ROWS = 6;
  var POP_OUT_DURATION = 800;       // ms
  var SHATTER_DELAY = 600;          // ms pause between pop-out and shatter
  var GRAVITY = 980;                // px/s^2
  var INITIAL_BURST_SPEED = 200;    // px/s outward
  var MAX_ANGULAR_VEL = 360;        // deg/s
  var FADE_START_TIME = 1.5;        // seconds into fall before tiles fade
  var TOTAL_ANIM_TIME = 3.0;        // seconds for full fall

  var crumbleSlide = null;
  var contentWrapper = null;
  var hasTriggered = false;
  var tileContainer = null;

  // === PHASE 2: Pop-Out ===
  function popOut() {
    return new Promise(function (resolve) {
      contentWrapper.classList.add('crumble-popout');
      setTimeout(resolve, POP_OUT_DURATION);
    });
  }

  // === PHASE 3: Shatter ===
  function shatter() {
    return new Promise(function (resolve) {
      // Rasterize the content wrapper
      html2canvas(contentWrapper, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false
      }).then(function (capturedCanvas) {
        var rect = contentWrapper.getBoundingClientRect();
        var tileW = rect.width / GRID_COLS;
        var tileH = rect.height / GRID_ROWS;
        var imgUrl = capturedCanvas.toDataURL();

        // Create tile container
        tileContainer = document.createElement('div');
        tileContainer.className = 'crumble-tile-container';
        document.body.appendChild(tileContainer);

        // Build tiles
        var tiles = [];
        for (var row = 0; row < GRID_ROWS; row++) {
          for (var col = 0; col < GRID_COLS; col++) {
            var tile = document.createElement('div');
            tile.className = 'crumble-tile';
            tile.style.width = tileW + 'px';
            tile.style.height = tileH + 'px';
            tile.style.left = (rect.left + col * tileW) + 'px';
            tile.style.top = (rect.top + row * tileH) + 'px';
            tile.style.backgroundImage = 'url(' + imgUrl + ')';
            tile.style.backgroundSize = rect.width + 'px ' + rect.height + 'px';
            tile.style.backgroundPosition = '-' + (col * tileW) + 'px -' + (row * tileH) + 'px';

            tileContainer.appendChild(tile);

            // Distance from center for burst direction
            var cx = (col - (GRID_COLS - 1) / 2) / (GRID_COLS / 2);
            var cy = (row - (GRID_ROWS - 1) / 2) / (GRID_ROWS / 2);

            tiles.push({
              el: tile,
              x: 0, y: 0, z: 0,
              vx: cx * INITIAL_BURST_SPEED + (Math.random() - 0.5) * 80,
              vy: -(Math.random() * INITIAL_BURST_SPEED * 0.4) - 30,
              vz: (Math.random() * 0.5 + 0.5) * INITIAL_BURST_SPEED * 0.3,
              rx: 0, ry: 0, rz: 0,
              arx: (Math.random() - 0.5) * MAX_ANGULAR_VEL,
              ary: (Math.random() - 0.5) * MAX_ANGULAR_VEL,
              arz: (Math.random() - 0.5) * MAX_ANGULAR_VEL
            });
          }
        }

        // Hide original content
        contentWrapper.style.visibility = 'hidden';

        // Small initial gap offset to show cracks
        for (var i = 0; i < tiles.length; i++) {
          var t = tiles[i];
          var ci = i % GRID_COLS;
          var ri = Math.floor(i / GRID_COLS);
          var gapX = (ci - (GRID_COLS - 1) / 2) * 2;
          var gapY = (ri - (GRID_ROWS - 1) / 2) * 2;
          t.x = gapX;
          t.y = gapY;
        }

        // Physics animation loop
        var startTime = null;
        var dt = 1 / 60;

        function frame(timestamp) {
          if (!startTime) startTime = timestamp;
          var elapsed = (timestamp - startTime) / 1000;

          if (elapsed > TOTAL_ANIM_TIME) {
            // Cleanup tiles
            if (tileContainer && tileContainer.parentNode) {
              tileContainer.parentNode.removeChild(tileContainer);
            }
            tileContainer = null;
            resolve();
            return;
          }

          for (var i = 0; i < tiles.length; i++) {
            var tile = tiles[i];

            // Gravity
            tile.vy += GRAVITY * dt;

            // Update position
            tile.x += tile.vx * dt;
            tile.y += tile.vy * dt;
            tile.z += tile.vz * dt;

            // Update rotation
            tile.rx += tile.arx * dt;
            tile.ry += tile.ary * dt;
            tile.rz += tile.arz * dt;

            // Fade in last portion
            var opacity = 1.0;
            if (elapsed > FADE_START_TIME) {
              opacity = 1.0 - (elapsed - FADE_START_TIME) / (TOTAL_ANIM_TIME - FADE_START_TIME);
              if (opacity < 0) opacity = 0;
            }

            tile.el.style.transform =
              'translate3d(' + tile.x + 'px, ' + tile.y + 'px, ' + tile.z + 'px) ' +
              'rotateX(' + tile.rx + 'deg) rotateY(' + tile.ry + 'deg) rotateZ(' + tile.rz + 'deg)';
            tile.el.style.opacity = opacity;
          }

          requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
      });
    });
  }

  // === ORCHESTRATOR ===
  function triggerCrumble() {
    if (hasTriggered) return;
    hasTriggered = true;

    // Start matrix rain (hidden behind opaque content)
    if (window.MatrixRain) {
      MatrixRain.start();
    }

    // Phase 2: Pop out
    popOut().then(function () {
      // Dramatic pause
      return new Promise(function (r) { setTimeout(r, SHATTER_DELAY); });
    }).then(function () {
      // Phase 3: Shatter
      return shatter();
    });
  }

  // === CLEANUP ===
  function cleanup() {
    if (tileContainer && tileContainer.parentNode) {
      tileContainer.parentNode.removeChild(tileContainer);
      tileContainer = null;
    }
    if (window.MatrixRain) {
      MatrixRain.stop();
    }
  }

  // === REVEAL.JS INTEGRATION ===
  function setup() {
    crumbleSlide = document.querySelector('[data-crumble-slide]');
    if (!crumbleSlide) return;
    contentWrapper = crumbleSlide.querySelector('.crumble-content-wrapper');
    if (!contentWrapper) return;

    // Guard: html2canvas must be loaded
    if (typeof html2canvas === 'undefined') {
      console.warn('html2canvas not loaded, crumble effect disabled');
      return;
    }

    // Start matrix rain when entering the crumble slide
    Reveal.on('slidechanged', function (event) {
      if (event.currentSlide === crumbleSlide && !hasTriggered) {
        if (window.MatrixRain) {
          MatrixRain.start();
        }
      }
      // Stop rain when leaving the crumble slide (and effect hasn't played)
      if (event.previousSlide === crumbleSlide && !hasTriggered) {
        if (window.MatrixRain) {
          MatrixRain.stop();
        }
      }
      // Stop rain when navigating away after effect has played
      if (event.previousSlide === crumbleSlide && hasTriggered) {
        cleanup();
      }
    });

    // Listen for the trigger fragment
    Reveal.on('fragmentshown', function (event) {
      if (!crumbleSlide.contains(event.fragment)) return;
      if (event.fragment.hasAttribute('data-crumble-trigger')) {
        triggerCrumble();
      }
    });

    // Handle direct navigation to the slide
    if (Reveal.getCurrentSlide() === crumbleSlide) {
      if (window.MatrixRain) {
        MatrixRain.start();
      }
    }
  }

  // === BOOTSTRAP (same pattern as chart-animation.js) ===
  function waitForReveal() {
    if (typeof Reveal === 'undefined') {
      window.addEventListener('load', waitForReveal);
      return;
    }
    if (Reveal.isReady && Reveal.isReady()) {
      setup();
    } else {
      Reveal.on('ready', setup);
    }
  }

  if (document.readyState === 'complete') {
    waitForReveal();
  } else {
    window.addEventListener('load', waitForReveal);
  }
})();
