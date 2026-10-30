/* =========================================================
   data.js  — ALL content and settings live here.
   Most Phase 2 changes only need edits in this file.
   Units: diam km · dist million km · period Earth days
          g m/s² · day hours · temp °C
          size / orbit are scene units (not to scale)
   ========================================================= */

const CONFIG = {
  orbitRate: 0.5,            // base orbit speed (rad/s at 1x for a 1-year orbit)
  startSpeed: 1,             // initial animation speed multiplier
  homeCamera: [0, 46, 82],   // overview camera position [x, y, z]
  showOrbits: true,          // orbit lines on/off at start
  showLabels: false,         // name labels on/off at start (selected body always shows its label)
  systemRadius: 66,          // outer edge of the system; the home camera backs off until this fits the screen
  focusDistance: 4.2,        // camera distance when focusing = size * this + 3
  starCount: 1800,           // background stars
  introSeconds: 4.2,         // length of the ENTER warp animation (3-6 s works well)
  entranceSeconds: 3.2,      // camera fly-in after the warp
  beltCount: 900,            // asteroid belt rocks
  beltRadius: [27.5, 31],    // belt inner/outer radius (between Mars and Jupiter)
  trailArc: 1.1,             // length of the glowing orbit trail (radians)
  tourSeconds: 7,            // seconds per stop in the guided tour
  trueScaleFactor: 0.6       // 'True proportions' mode: Earth's radius in scene units
};

/* Filter chips. Each body's `group` must match one of these (except 'All'). */
const FILTERS = ['All', 'Star', 'Rocky', 'Gas giant', 'Ice giant'];

/* Rows in the comparison chart. `k` must be a numeric field on each body. */
const PARAMS = [
  { k: 'diam',   label: 'Diameter',          unit: 'km',   mi: 'mi',   f: 0.621371 },
  { k: 'dist',   label: 'Distance from Sun', unit: 'M km', mi: 'M mi', f: 0.621371 },
  { k: 'period', label: 'Orbital period',    unit: 'days' },
  { k: 'g',      label: 'Surface gravity',   unit: 'm/s²' },
  { k: 'day',    label: 'Day length',        unit: 'h'    }
];

/* The bodies. `ring:true` adds a ring. `moons` adds orbiting moons. */
const BODIES = [
  { id:'sun', name:'Sun', type:'Star', group:'Star', color:'#ffb347', c2:'#ff7a1a',
    diam:1392700, dist:0, period:0, g:274, day:609.1, temp:5500, size:5, orbit:0,
    about:'The star at the centre of the system. It holds about 99.8% of all the mass in the solar system.' },

  { id:'mercury', name:'Mercury', type:'Rocky planet', group:'Rocky', color:'#9a928a', c2:'#5f5851',
    diam:4879, dist:57.9, period:88, g:3.7, day:1407.6, temp:167, size:.6, orbit:11,
    about:'The smallest planet and the closest to the Sun. It has almost no atmosphere, so temperatures swing wildly.' },

  { id:'venus', name:'Venus', type:'Rocky planet', group:'Rocky', color:'#e3b778', c2:'#b9843f', atmo:'#ffd9a0',
    diam:12104, dist:108.2, period:224.7, g:8.9, day:5832.5, temp:464, size:1.0, orbit:15,
    about:'Wrapped in thick clouds, Venus is the hottest planet. It spins backwards compared with most planets.' },

  { id:'earth', name:'Earth', type:'Rocky planet', group:'Rocky', color:'#2f6fd0', c2:'#3f9b55', atmo:'#5aa9ff',
    diam:12756, dist:149.6, period:365.2, g:9.8, day:24, temp:15, size:1.05, orbit:19.5,
    moons:[ { name:'Moon', size:.28, orbit:2.2, period:27.3, color:'#bdbdbd' } ],
    about:'Our home and the only known world with life. About 71% of its surface is covered by liquid water.' },

  { id:'mars', name:'Mars', type:'Rocky planet', group:'Rocky', color:'#c1583a', c2:'#7d2f1c', atmo:'#ff9a70',
    diam:6792, dist:228, period:687, g:3.7, day:24.6, temp:-65, size:.75, orbit:24,
    about:'A cold desert world with the tallest volcano in the solar system, Olympus Mons.' },

  { id:'jupiter', name:'Jupiter', type:'Gas giant', group:'Gas giant', color:'#d6b48f', c2:'#a2603a',
    diam:142984, dist:778.5, period:4331, g:23.1, day:9.9, temp:-110, size:3.3, orbit:34,
    about:'The largest planet. Its Great Red Spot is a storm wider than Earth that has raged for centuries.' },

  { id:'saturn', name:'Saturn', type:'Gas giant', group:'Gas giant', color:'#e0cc9b', c2:'#b39a62',
    diam:120536, dist:1432, period:10747, g:9.0, day:10.7, temp:-140, size:2.8, orbit:45, ring:true,
    about:'Famous for its wide ring system made of ice and rock. It is less dense than water.' },

  { id:'uranus', name:'Uranus', type:'Ice giant', group:'Ice giant', color:'#8fd8de', c2:'#5fb3be',
    diam:51118, dist:2867, period:30589, g:8.7, day:17.2, temp:-195, size:1.9, orbit:54,
    about:'An ice giant tilted on its side, so it rolls around the Sun like a ball.' },

  { id:'neptune', name:'Neptune', type:'Ice giant', group:'Ice giant', color:'#3f5fd6', c2:'#2a3f9c',
    diam:49528, dist:4515, period:59800, g:11, day:16.1, temp:-200, size:1.85, orbit:62,
    about:'The farthest planet, with supersonic winds. It takes about 165 Earth years to orbit once.' }

  /* ---- EXAMPLE: add a new body by pasting an object here (remember the comma above) ----
  ,{ id:'pluto', name:'Pluto', type:'Dwarf planet', group:'Dwarf', color:'#c9b8a6', c2:'#8a7968',
    diam:2377, dist:5906, period:90560, g:0.62, day:153.3, temp:-225, size:.4, orbit:69,
    about:'A dwarf planet in the Kuiper belt. Add "Dwarf" to FILTERS to get its own filter chip.' }
  ------------------------------------------------------------------------------------------- */
];


/* =========================================================
   STORIES: the scroll sections under the solar system.
   `id` must match a body above. `side` = which side the big 3D planet sits on.
   Keep them in orbital order (Mercury to Neptune). Text and facts are plain strings: edit freely. Add or remove entries to change the page length.
   ========================================================= */
const STORIES = [
  { id:'mercury', side:'right', scale:1.0, tilt:.03, kicker:'The Swift Planet',
    title:'A scorched world of extremes',
    text:'The smallest planet and the closest to the Sun, Mercury swings from blazing days to freezing nights. Its cratered surface looks a lot like our Moon.',
    facts:[['Diameter','4,879 km'],['Year','88 days'],['Moons','0']] },
  { id:'venus', side:'left', scale:1.6, tilt:.05, kicker:'The Veiled Planet',
    title:'A runaway greenhouse hidden under clouds',
    text:'Thick clouds of carbon dioxide trap heat, making Venus the hottest planet, even hotter than Mercury. It spins backwards, so the Sun rises in the west.',
    facts:[['Diameter','12,104 km'],['Year','224.7 days'],['Moons','0']] },
  { id:'earth', side:'right', scale:1.9, tilt:.41, kicker:'The Blue Planet',
    title:'The only world we know that holds life',
    text:'Earth is wrapped in a thin atmosphere and covered mostly by liquid water. Its magnetic field and steady distance from the Sun keep conditions gentle enough for life to flourish.',
    facts:[['Diameter','12,756 km'],['Year','365.2 days'],['Moons','1']] },
  { id:'mars', side:'left', scale:1.55, tilt:.44, kicker:'The Red Planet',
    title:'A frozen desert with a watery past',
    text:'Iron oxide gives Mars its rusty colour. Dry river valleys and polar ice caps hint at a wetter past, and Olympus Mons is the tallest volcano in the solar system.',
    facts:[['Diameter','6,792 km'],['Year','687 days'],['Moons','2']] },
  { id:'jupiter', side:'right', scale:2.35, tilt:.05, kicker:'The Giant',
    title:'More massive than all the other planets combined',
    text:'Jupiter is a gas giant of swirling bands and enormous storms. The Great Red Spot has raged for centuries, and the planet’s gravity shapes the paths of many bodies around it.',
    facts:[['Diameter','142,984 km'],['Day','9.9 hours'],['Moons','95+']] },
  { id:'saturn', side:'left', scale:1.35, tilt:.47, kicker:'The Ringed Wonder',
    title:'Rings of ice stretching across the sky',
    text:'Saturn’s rings are billions of pieces of ice and rock, from dust grains to house-sized boulders. The planet is so light for its size that it would float in water.',
    facts:[['Diameter','120,536 km'],['Year','29.4 years'],['Moons','145+']] },
  { id:'uranus', side:'right', scale:1.6, tilt:1.5, kicker:'The Tilted Ice Giant',
    title:'A planet that rolls around the Sun on its side',
    text:'Uranus is tilted almost at a right angle, so its poles take turns facing the Sun for decades. Methane in its atmosphere gives it a pale blue-green glow.',
    facts:[['Diameter','51,118 km'],['Year','84 years'],['Moons','27+']] },
  { id:'neptune', side:'left', scale:1.55, tilt:.49, kicker:'The Distant Giant',
    title:'Supersonic winds at the edge of the planets',
    text:'Neptune is the farthest planet, a deep blue world with the fastest winds in the solar system. It takes about 165 Earth years to complete a single orbit.',
    facts:[['Diameter','49,528 km'],['Year','165 years'],['Moons','14+']] }
];
