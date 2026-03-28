(function () {
  'use strict';

  // === CONFIGURATION ===
  var GRID_COLS = 6;
  var GRID_ROWS = 4;
  var JITTER_FACTOR = 0.3;
  var EDGE_SUBDIVISIONS = 2;
  var EDGE_JITTER = 0.15;
  var PIVOT_DURATION = 1200;        // ms for wall tilt
  var PIVOT_MAX_ANGLE = -25;        // degrees rotateX (tilts bottom toward viewer)
  var SHATTER_DELAY = 200;          // ms pause at max tilt before shatter
  var GRAVITY = 980;                // px/s^2
  var INITIAL_BURST_SPEED = 200;    // px/s outward
  var MAX_ANGULAR_VEL = 360;        // deg/s
  var FADE_START_TIME = 1.5;        // seconds into fall before tiles fade
  var TOTAL_ANIM_TIME = 3.0;        // seconds for full fall
  var MATRIX_DISPLAY_TIME = 3000;   // ms to show rain after tiles gone
  var MATRIX_FADE_TIME = 1000;      // ms to fade out rain

  var crumbleSlide = null;
  var contentWrapper = null;
  var hasTriggered = false;
  var tileContainer = null;
  var capturedImageUrl = null;

  // === JAGGED FRAGMENT GENERATION ===
  function generateJaggedFragments(width, height, cols, rows) {
    var cellW = width / cols;
    var cellH = height / rows;
    var jitterX = cellW * JITTER_FACTOR;
    var jitterY = cellH * JITTER_FACTOR;

    // Step 1: Create vertex grid with jitter on interior points
    var vertices = [];
    for (var r = 0; r <= rows; r++) {
      vertices[r] = [];
      for (var c = 0; c <= cols; c++) {
        var x = c * cellW;
        var y = r * cellH;
        if (r > 0 && r < rows && c > 0 && c < cols) {
          x += (Math.random() - 0.5) * 2 * jitterX;
          y += (Math.random() - 0.5) * 2 * jitterY;
        }
        vertices[r][c] = { x: x, y: y };
      }
    }

    // Step 2: Create edge midpoints with jitter for jagged edges
    // Horizontal edges
    var hEdgeMids = [];
    for (var r = 0; r <= rows; r++) {
      hEdgeMids[r] = [];
      for (var c = 0; c < cols; c++) {
        var mids = [];
        var v0 = vertices[r][c];
        var v1 = vertices[r][c + 1];
        for (var s = 1; s <= EDGE_SUBDIVISIONS; s++) {
          var t = s / (EDGE_SUBDIVISIONS + 1);
          var mx = v0.x + (v1.x - v0.x) * t;
          var my = v0.y + (v1.y - v0.y) * t;
          var isEdgeRow = (r === 0 || r === rows);
          if (!isEdgeRow) {
            my += (Math.random() - 0.5) * 2 * cellH * EDGE_JITTER;
          }
          mids.push({ x: mx, y: my });
        }
        hEdgeMids[r][c] = mids;
      }
    }

    // Vertical edges
    var vEdgeMids = [];
    for (var r = 0; r < rows; r++) {
      vEdgeMids[r] = [];
      for (var c = 0; c <= cols; c++) {
        var mids = [];
        var v0 = vertices[r][c];
        var v1 = vertices[r + 1][c];
        for (var s = 1; s <= EDGE_SUBDIVISIONS; s++) {
          var t = s / (EDGE_SUBDIVISIONS + 1);
          var mx = v0.x + (v1.x - v0.x) * t;
          var my = v0.y + (v1.y - v0.y) * t;
          var isEdgeCol = (c === 0 || c === cols);
          if (!isEdgeCol) {
            mx += (Math.random() - 0.5) * 2 * cellW * EDGE_JITTER;
          }
          mids.push({ x: mx, y: my });
        }
        vEdgeMids[r][c] = mids;
      }
    }

    // Step 3: Build polygon for each cell
    var fragments = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var points = [];

        // Top edge: left to right
        points.push(vertices[r][c]);
        for (var i = 0; i < hEdgeMids[r][c].length; i++) {
          points.push(hEdgeMids[r][c][i]);
        }
        points.push(vertices[r][c + 1]);

        // Right edge: top to bottom
        for (var i = 0; i < vEdgeMids[r][c + 1].length; i++) {
          points.push(vEdgeMids[r][c + 1][i]);
        }
        points.push(vertices[r + 1][c + 1]);

        // Bottom edge: right to left (reversed)
        var botMids = hEdgeMids[r + 1][c].slice().reverse();
        for (var i = 0; i < botMids.length; i++) {
          points.push(botMids[i]);
        }
        points.push(vertices[r + 1][c]);

        // Left edge: bottom to top (reversed)
        var leftMids = vEdgeMids[r][c].slice().reverse();
        for (var i = 0; i < leftMids.length; i++) {
          points.push(leftMids[i]);
        }

        // Compute center
        var cx = 0, cy = 0;
        for (var i = 0; i < points.length; i++) {
          cx += points[i].x;
          cy += points[i].y;
        }
        cx /= points.length;
        cy /= points.length;

        fragments.push({
          points: points,
          centerX: cx,
          centerY: cy
        });
      }
    }

    return fragments;
  }

  // === PHASE 2: Wall Pivot (JS-driven) ===
  function pivotWall() {
    return new Promise(function (resolve) {
      contentWrapper.classList.add('crumble-popout');
      var startTime = null;

      function frame(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = timestamp - startTime;
        var progress = Math.min(elapsed / PIVOT_DURATION, 1.0);

        // Ease-in: slow start, accelerating like gravity pulling wall forward
        var eased = progress * progress;
        var angle = PIVOT_MAX_ANGLE * eased;
        var shadowBlur = 20 + 40 * progress;
        var shadowY = 10 + 20 * progress;

        contentWrapper.style.transform =
          'perspective(1200px) rotateX(' + angle + 'deg) rotateY(' + (2 * eased) + 'deg)';
        contentWrapper.style.boxShadow =
          '0 ' + shadowY + 'px ' + shadowBlur + 'px rgba(0,0,0,' + (0.3 + 0.3 * progress) + ')';

        if (progress < 1.0) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  // === PHASE 3: Shatter ===
  function shatter() {
    return new Promise(function (resolve) {
      var rect = contentWrapper.getBoundingClientRect();
      var fragments = generateJaggedFragments(rect.width, rect.height, GRID_COLS, GRID_ROWS);

      // Create tile container
      tileContainer = document.createElement('div');
      tileContainer.className = 'crumble-tile-container';
      document.body.appendChild(tileContainer);

      var tiles = [];
      for (var i = 0; i < fragments.length; i++) {
        var frag = fragments[i];
        var tile = document.createElement('div');
        tile.className = 'crumble-tile';

        // Each tile covers the full captured area
        tile.style.width = rect.width + 'px';
        tile.style.height = rect.height + 'px';
        tile.style.left = rect.left + 'px';
        tile.style.top = rect.top + 'px';
        tile.style.backgroundImage = 'url(' + capturedImageUrl + ')';
        tile.style.backgroundSize = rect.width + 'px ' + rect.height + 'px';
        tile.style.backgroundPosition = '0 0';

        // Build clip-path polygon
        var clipPoints = [];
        for (var j = 0; j < frag.points.length; j++) {
          clipPoints.push(frag.points[j].x + 'px ' + frag.points[j].y + 'px');
        }
        tile.style.clipPath = 'polygon(' + clipPoints.join(', ') + ')';

        tileContainer.appendChild(tile);

        // Physics: direction from center of slide
        var relCx = (frag.centerX - rect.width / 2) / (rect.width / 2);
        var relCy = (frag.centerY - rect.height / 2) / (rect.height / 2);

        tiles.push({
          el: tile,
          x: 0, y: 0, z: 0,
          // Start with the wall's tilted rotation
          rx: PIVOT_MAX_ANGLE,
          ry: 2, rz: 0,
          vx: relCx * INITIAL_BURST_SPEED + (Math.random() - 0.5) * 80,
          vy: -(Math.random() * INITIAL_BURST_SPEED * 0.4) - 30,
          vz: (Math.random() * 0.5 + 0.5) * INITIAL_BURST_SPEED * 0.3,
          // Bias arx toward continued forward rotation
          arx: (Math.random() - 0.5) * MAX_ANGULAR_VEL - 90,
          ary: (Math.random() - 0.5) * MAX_ANGULAR_VEL,
          arz: (Math.random() - 0.5) * MAX_ANGULAR_VEL
        });
      }

      // Hide original content
      contentWrapper.style.visibility = 'hidden';

      // Physics animation loop
      var startTime = null;
      var dt = 1 / 60;

      function frame(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = (timestamp - startTime) / 1000;

        if (elapsed > TOTAL_ANIM_TIME) {
          if (tileContainer && tileContainer.parentNode) {
            tileContainer.parentNode.removeChild(tileContainer);
          }
          tileContainer = null;
          resolve();
          return;
        }

        for (var i = 0; i < tiles.length; i++) {
          var t = tiles[i];

          t.vy += GRAVITY * dt;
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.z += t.vz * dt;
          t.rx += t.arx * dt;
          t.ry += t.ary * dt;
          t.rz += t.arz * dt;

          var opacity = 1.0;
          if (elapsed > FADE_START_TIME) {
            opacity = 1.0 - (elapsed - FADE_START_TIME) / (TOTAL_ANIM_TIME - FADE_START_TIME);
            if (opacity < 0) opacity = 0;
          }

          t.el.style.transform =
            'translate3d(' + t.x + 'px, ' + t.y + 'px, ' + t.z + 'px) ' +
            'rotateX(' + t.rx + 'deg) rotateY(' + t.ry + 'deg) rotateZ(' + t.rz + 'deg)';
          t.el.style.opacity = opacity;
        }

        requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
    });
  }

  // === PHASE 4: Show Matrix Then Fade Out ===
  function showMatrixThenFade() {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var canvas = document.getElementById('matrix-rain-canvas');
        if (canvas) {
          canvas.style.transition = 'opacity ' + MATRIX_FADE_TIME + 'ms ease';
          canvas.style.opacity = '0';
        }
        setTimeout(function () {
          if (window.MatrixRain) {
            MatrixRain.destroy();
          }
          // Restore slide section background
          if (crumbleSlide) {
            crumbleSlide.classList.remove('crumble-active');
          }
          resolve();
        }, MATRIX_FADE_TIME);
      }, MATRIX_DISPLAY_TIME);
    });
  }

  // === ORCHESTRATOR ===
  function triggerCrumble() {
    if (hasTriggered) return;
    hasTriggered = true;

    // Step 1: Capture the slide image while it's still flat
    html2canvas(contentWrapper, {
      backgroundColor: '#1a1a2e',
      scale: 2,
      logging: false
    }).then(function (capturedCanvas) {
      capturedImageUrl = capturedCanvas.toDataURL();

      // Step 2: Make section transparent and start matrix rain
      crumbleSlide.classList.add('crumble-active');
      if (window.MatrixRain) {
        MatrixRain.start();
      }

      // Step 3: Wall pivot
      return pivotWall();
    }).then(function () {
      // Step 4: Brief pause at max tilt
      return new Promise(function (r) { setTimeout(r, SHATTER_DELAY); });
    }).then(function () {
      // Step 5: Shatter into jagged fragments
      return shatter();
    }).then(function () {
      // Step 6: Show matrix rain then fade out
      return showMatrixThenFade();
    });
  }

  // === CLEANUP ===
  function cleanup() {
    if (tileContainer && tileContainer.parentNode) {
      tileContainer.parentNode.removeChild(tileContainer);
      tileContainer = null;
    }
    if (crumbleSlide) {
      crumbleSlide.classList.remove('crumble-active');
    }
    if (window.MatrixRain) {
      MatrixRain.destroy();
    }
  }

  // === REVEAL.JS INTEGRATION ===
  function setup() {
    crumbleSlide = document.querySelector('[data-crumble-slide]');
    if (!crumbleSlide) return;
    contentWrapper = crumbleSlide.querySelector('.crumble-content-wrapper');
    if (!contentWrapper) return;

    if (typeof html2canvas === 'undefined') {
      console.warn('html2canvas not loaded, crumble effect disabled');
      return;
    }

    // Only cleanup when navigating away from the crumble slide
    Reveal.on('slidechanged', function (event) {
      if (event.previousSlide === crumbleSlide) {
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
  }

  // === BOOTSTRAP ===
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
