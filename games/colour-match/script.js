// Standalone: do not import from /shared/ or other game folders.

// Calm, muted palette — no pure saturated red/green (avoids
// stop/go or right/wrong associations), distinguishable by more than
// hue alone (kept fairly different in lightness too). Each colour also
// gets its own shape (see SHAPE_PATHS) drawn on top of the fill, so
// colour-vision-deficient or greyscale-display players still have a
// non-colour way to match tiles, per the project's "never rely on
// colour alone" rule.
const PALETTE = [
  { name: "empty", hex: "#eae7e0", shape: null },
  { name: "sage", hex: "#8ea88a", shape: "circle" },
  { name: "clay", hex: "#c98f6b", shape: "triangle" },
  { name: "sky", hex: "#7fa8bf", shape: "square" },
  { name: "plum", hex: "#9b829e", shape: "diamond" },
  { name: "sand", hex: "#d6b27a", shape: "cross" },
  { name: "rose", hex: "#c48e96", shape: "star" },
];

// Simple, calm glyphs (not childish icons) drawn via clip-path so they
// scale crisply at any cell size with no extra image asset.
const SHAPE_CLIP_PATHS = {
  circle: "circle(32% at 50% 50%)",
  square: "polygon(30% 30%, 70% 30%, 70% 70%, 30% 70%)",
  triangle: "polygon(50% 26%, 76% 72%, 24% 72%)",
  diamond: "polygon(50% 24%, 76% 50%, 50% 76%, 24% 50%)",
  cross: "polygon(40% 22%, 60% 22%, 60% 40%, 78% 40%, 78% 60%, 60% 60%, 60% 78%, 40% 78%, 40% 60%, 22% 60%, 22% 40%, 40% 40%)",
  star: "polygon(50% 20%, 61% 40%, 84% 40%, 66% 54%, 73% 76%, 50% 63%, 27% 76%, 34% 54%, 16% 40%, 39% 40%)",
};

const GRID_SIZES = [3, 4, 5, 6, 8, 10, 12, 14];
const COLOUR_COUNTS = [2, 3, 4, 5, 6];

// Built-in pictures, hand-authored separately for each grid size (not
// scaled/downsampled — a shape that reads at 5x5 turns into a blob if
// you naively resample it down to 3x3, so each resolution gets its own
// pixel art). Each picture declares exactly the colours it needs — the
// palette shown during play always includes those, regardless of the
// colour-count setting (that setting only governs Random mode).
function grid(rows) {
  const key = {
    ".": "empty",
    s: "sage",
    c: "clay",
    k: "sky",
    p: "plum",
    a: "sand",
    r: "rose",
  };
  return rows.join("").split("").map((ch) => key[ch]);
}

const PICTURES = {
  sun: {
    label: "Sun",
    grids: {
      3: grid(["aca", "cac", "aca"]),
      4: grid(["acca", "caac", "caac", "acca"]),
      5: grid(["c.c.c", ".aca.", "ccacc", ".aca.", "c.c.c"]),
      6: grid(["c.c..c", ".caac.", ".accac", "cacca.", ".caac.", "c..c.c"]),
      8: grid(["...c..a.", "aa..c.a.", "..aaca..", ".cccca.c", "c.acccc.", "..acaa..", ".a.c..aa", ".a..c..."]),
      10: grid(["....p.....", "..........", "..p.pp.p..", "...pppp...", "p.ppppppp.", "p.pppppp..", "...pppp...", "..p.pp.p..", "....p.....", ".........."]),
      12: grid([".....pp.....", "............", "..p..pp..p..", "...pppppp...", "...pppppp...", "...pppppp...", "p.ppppppp.p.", "...pppppp...", "...pppppp...", "..p......p..", "......p.....", "............"]),
      14: grid(["......p.......", "..............", "..p...p....p..", "...p.pppp.p...", "....pppppp....", "...pppppppp...", "p.ppppppppp.p.", "p.ppppppppp...", "...pppppppp...", "....pppppp....", "...p.pppp.p...", "..p........p..", "......p.......", ".............."]),
    },
  },
  moon: {
    label: "Moon",
    grids: {
      3: grid([".a.", "aa.", ".a."]),
      4: grid([".aa.", "aaa.", "aaa.", ".aa."]),
      5: grid(["..a..", ".aaa.", "aaa..", ".aaa.", "..a.."]),
      6: grid(["......", ".aa...", ".a....", ".a....", ".aa...", "......"]),
      8: grid(["........", "..aa....", ".aa.....", ".aa.....", ".aa.....", ".aa.....", "..aa....", "........"]),
      10: grid(["..........", "...aaa....", "..aaa.....", ".aaa......", ".aaa......", ".aaa......", ".aaa......", "..aaa.....", "...aaa....", ".........."]),
      12: grid(["............", "....aaa.....", "..aaaa......", "..aaa.......", ".aaaa.......", ".aaaa.......", ".aaaa.......", ".aaaa.......", "..aaa.......", "..aaaa......", "....aaa.....", "............"]),
      14: grid(["..............", ".....aaaa.....", "...aaaa.......", "..aaaa........", "..aaaa........", ".aaaaa........", ".aaaa.........", ".aaaa.........", ".aaaaa........", "..aaaa........", "..aaaa........", "...aaaa.......", ".....aaaa.....", ".............."]),
    },
  },
  house: {
    label: "House",
    grids: {
      3: grid(["ccc", "kkk", "kak"]),
      4: grid(["cccc", "kkkk", "kkkk", "kkak"]),
      5: grid([".ccc.", "ccccc", "kkkkk", "kkkkk", "kkakk"]),
      6: grid(["..cc..", "cccccc", "kkkkkk", "kkkkkk", "kkakkk", "kkakkk"]),
      8: grid(["...cc...", "..cccc..", "cccccccc", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk", "kkkkakkk", "kkkkakkk"]),
      10: grid(["....cc....", "..cccccc..", "cccccccccc", "kkkkkkkkkk", "kkkkkkkkkk", "kkkkkkkkkk", "kkkkkkkkkk", "kkkkaakkkk", "kkkkaakkkk", "kkkkaakkkk"]),
      12: grid([".....cc.....", "...cccccc...", "..cccccccc..", "cccccccccccc", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkaakkkkk", "kkkkkaakkkkk", "kkkkkaakkkkk"]),
      14: grid(["......cc......", "....cccccc....", "..cccccccccc..", "cccccccccccccc", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkaakkkkkk", "kkkkkkaakkkkkk", "kkkkkkaakkkkkk", "kkkkkkaakkkkkk"]),
    },
  },
  flower: {
    label: "Flower",
    grids: {
      3: grid([".p.", "psp", ".s."]),
      4: grid(["..p.", ".psp", "..s.", "..s."]),
      5: grid(["..p..", "pprpp", "pprpp", "..s..", "..s.."]),
      6: grid(["..pp..", ".pppp.", ".prrp.", "..sp..", "..sp..", "..s..."]),
      8: grid(["...pp...", "...pp...", ".pprrpp.", ".pprrpp.", "...ps...", "...ps...", "....s...", "....s..."]),
      10: grid(["...pppp...", "..pppppp..", "..pppppp..", ".ppprrppp.", ".ppprrppp.", "..ppsppp..", "..ppsppp..", "....sp....", "....s.....", "....s....."]),
      12: grid(["...pppppp...", "..pppppppp..", "..pppppppp..", ".pppprrpppp.", ".ppprrrrppp.", "..ppprrppp..", "..ppppsppp..", "..ppppsppp..", ".....ps.....", "......s.....", "......s.....", "......s....."]),
      14: grid(["....pppppp....", "...pppppppp...", "..pppppppppp..", "..pppprrpppp..", ".pppprrrrpppp.", ".pppprrrrpppp.", "..pppprrpppp..", "..ppppsppppp..", "...pppspppp...", "....ppsppp....", "......sp......", "......s.......", "......s.......", "......s......."]),
    },
  },
  cat: {
    label: "Cat",
    grids: {
      3: grid(["a.a", "aaa", ".a."]),
      4: grid(["a..a", "aaaa", "aaaa", ".aa."]),
      5: grid(["a...a", ".aaa.", "aaaaa", "aaaaa", ".aaa."]),
      6: grid([".a..a.", ".aaaa.", "..aa..", ".appa.", ".aaaa.", "..aa.."]),
      8: grid(["........", "..a..a..", ".aaaaaa.", "..aaaa..", ".aaaaaa.", ".apaapa.", "..aaaa..", "..aaaa.."]),
      10: grid(["..........", "...a..a...", ".aaaaaaaa.", "...aaaa...", "..aaaaaa..", "..aaaaaa..", "..apaapa..", "..aaaaaa..", "..aaaaaa..", "...aaaa..."]),
      12: grid(["............", "...a....a...", "...aa..aa...", "..aaaaaaaa..", "...aaaaaa...", "...aaaaaa...", "..aaaaaaaa..", "..aapaapaa..", "..aaaaaaaa..", "..aaaaaaaa..", "...aaaaaa...", ".....aa....."]),
      14: grid(["..............", "..............", "....a....a....", "...aaa..aaa...", "..aaaaaaaaaa..", "....aaaaaa....", "...aaaaaaaa...", "..aaaaaaaaaa..", "..aaapaapaaa..", "..aaaaaaaaaa..", "...aaaaaaaa...", "...aaaaaaaa...", "....aaaaaa....", "......aa......"]),
    },
  },
  dog: {
    label: "Dog",
    grids: {
      3: grid(["c.c", "ccc", ".a."]),
      4: grid(["c..c", "cccc", "cccc", ".aa."]),
      5: grid(["c...c", ".ccc.", "ccccc", "ccccc", ".aa.."]),
      6: grid(["......", "..cc..", "ccppcc", "ccaacc", "ccaacc", "cc..cc"]),
      8: grid(["........", "........", "..cccc..", ".ccppcc.", ".cccccc.", ".ccaacc.", ".ccaacc.", ".cc..cc."]),
      10: grid(["..........", "..........", "...cccc...", "..cccccc..", ".ccpccpcc.", ".cccccccc.", ".cccaaccc.", ".cccaaccc.", ".cc....cc.", ".........."]),
      12: grid(["............", "............", "....cccc....", "...cccccc...", "..cccccccc..", ".cccpccpccc.", ".cccccccccc.", ".cccaaaaccc.", ".cccaaaaccc.", ".cc.cccc.cc.", ".cc......cc.", "............"]),
      14: grid(["..............", "..............", "......cc......", "....cccccc....", "...cccccccc...", "...cccccccc...", "..cccpccpccc..", "..cccccccccc..", "..cccaaaaccc..", "..cccaaaaccc..", "..cccaaaaccc..", "..cc......cc..", "..cc......cc..", ".............."]),
    },
  },
  butterfly: {
    label: "Butterfly",
    grids: {
      3: grid(["k.k", "ksk", "r.r"]),
      4: grid(["kksk", "kksk", "rrsr", ".rr."]),
      5: grid(["kk.kk", "kkskk", "kkskk", "rrsrr", ".rsr."]),
      6: grid(["..s...", ".ks.k.", "kks.kk", ".ks.k.", ".rs.r.", ".rs.r."]),
      8: grid(["....s...", "....s...", ".kk.skk.", ".kk.skk.", ".kk.skk.", ".rr.srr.", ".rr.srr.", "....s..."]),
      10: grid(["....s.....", "....s.....", ".kkks.kkk.", ".kkks.kkk.", ".kkks.kkk.", ".kkks.kkk.", ".rrrs.rrr.", ".rrrs.rrr.", "..rrs.rr..", "....s....."]),
      12: grid(["......s.....", "......s.....", "..kk..s.kk..", ".kkkk.skkkk.", ".kkkk.skkkk.", ".kkkk.skkkk.", "..kkk.skkk..", "..rrr.srrr..", ".rrrr.srrrr.", "..rrr.srrr..", "...r..s.r...", "......s....."]),
      14: grid(["......s.......", "......s.......", "...k..s...k...", ".kkkkks.kkkkk.", ".kkkkks.kkkkk.", ".kkkkks.kkkkk.", ".kkkkks.kkkkk.", "..kkk.s..kkk..", "..rrr.s..rrr..", "..rrrrs.rrrr..", "..rrrrs.rrrr..", "..rrr.s..rrr..", "......s.......", "......s......."]),
    },
  },
  fish: {
    label: "Fish",
    grids: {
      3: grid(["k.c", "kkc", "k.c"]),
      4: grid([".kk.", "kkkc", "kkkc", ".kk."]),
      5: grid(["..k..", ".kkk.", "kkkkc", ".kkk.", "..k.."]),
      6: grid(["......", "..kk.c", ".kpkcc", ".kkkcc", "..kk.c", "......"]),
      8: grid(["........", "........", ".kkkkk.c", ".kpkkkcc", ".kkkkkcc", ".kkkkk.c", "........", "........"]),
      10: grid(["..........", "..........", "..kkkk...c", ".kkkkkk.cc", ".kkpkkkccc", ".kkkkkkccc", ".kkkkkk.cc", "..kkkk...c", "..........", ".........."]),
      12: grid(["............", "............", "....kk......", "..kkkkkk..cc", ".kkpkkkkkccc", ".kkkkkkkcccc", ".kkkkkkkcccc", ".kkkkkkkkccc", "..kkkkkk..cc", "....kk......", "............", "............"]),
      14: grid(["..............", "..............", "..............", "...kkkkkk....c", "..kkkkkkkk..cc", ".kkkpkkkkkkccc", ".kkkkkkkkkcccc", ".kkkkkkkkkcccc", ".kkkkkkkkkkccc", "..kkkkkkkk..cc", "...kkkkkk....c", "..............", "..............", ".............."]),
    },
  },
  mushroom: {
    label: "Mushroom",
    grids: {
      3: grid([".r.", ".a.", ".a."]),
      4: grid([".rr.", "rrrr", ".aa.", ".aa."]),
      5: grid(["..r..", "rrrrr", ".aaa.", ".aaa.", ".aaa."]),
      6: grid(["..rr..", ".rrrr.", ".rrrr.", "..aa..", "..aa..", "..aa.."]),
      8: grid(["...ra...", ".rarrar.", ".rrrrrr.", "...aa...", "...aa...", "...aa...", "...aa...", "...aa..."]),
      10: grid(["...rrrr...", ".rraraarr.", ".rrrrrrrr.", "..........", "...aaaa...", "...aaaa...", "...aaaa...", "...aaaa...", "...aaaa...", "...aaaa..."]),
      12: grid(["....rrrr....", "..rarrarrr..", ".rrrrrrrarr.", ".rrrrrrrrrr.", "............", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa...."]),
      14: grid([".....rrrr.....", "..rrrrrarrrr..", "..rrarrrrarr..", ".rrrrrrrrrrrr.", ".rrrrrrrrrrrr.", "..............", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa....."]),
    },
  },
  umbrella: {
    label: "Umbrella",
    grids: {
      3: grid([".p.", "ppp", ".c."]),
      4: grid([".pp.", "pppp", ".c..", ".c.."]),
      5: grid(["..p..", ".ppp.", "ppppp", "..c..", "..c.."]),
      6: grid(["pppppp", "......", "..c...", "..c...", "..c...", "..cc.."]),
      8: grid(["pppppppp", "pppppppp", "........", "....c...", "....c...", "....c...", "....c...", "....cc.."]),
      10: grid(["pppppppppp", ".pppppppp.", "..........", "....c.....", "....c.....", "....c.....", "....c.....", "....c.....", "....c.....", "....cc...."]),
      12: grid(["pppppppppppp", "pppppppppppp", ".pppppppppp.", "............", "......c.....", "......c.....", "......c.....", "......c.....", "......c.....", "......c.....", "......c.....", "......cc...."]),
      14: grid(["pppppppppppppp", "pppppppppppppp", ".pppppppppppp.", "..pppppppppp..", "..............", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......cc......"]),
    },
  },
  moon: {
    label: "Moon",
    grids: {
      3: grid([".a.", "aa.", ".a."]),
      4: grid([".aa.", "aaa.", "aaa.", ".aa."]),
      5: grid(["..a..", ".aaa.", "aaa..", ".aaa.", "..a.."]),
      6: grid(["......", ".aa...", ".a....", ".a....", ".aa...", "......"]),
      8: grid(["........", "..aa....", ".aa.....", ".aa.....", ".aa.....", ".aa.....", "..aa....", "........"]),
      10: grid(["..........", "...aaa....", "..aaa.....", ".aaa......", ".aaa......", ".aaa......", ".aaa......", "..aaa.....", "...aaa....", ".........."]),
      12: grid(["............", "....aaa.....", "..aaaa......", "..aaa.......", ".aaaa.......", ".aaaa.......", ".aaaa.......", ".aaaa.......", "..aaa.......", "..aaaa......", "....aaa.....", "............"]),
      14: grid(["..............", ".....aaaa.....", "...aaaa.......", "..aaaa........", "..aaaa........", ".aaaaa........", ".aaaa.........", ".aaaa.........", ".aaaaa........", "..aaaa........", "..aaaa........", "...aaaa.......", ".....aaaa.....", ".............."]),
    },
  },
  house: {
    label: "House",
    grids: {
      3: grid(["ccc", "kkk", "kak"]),
      4: grid(["cccc", "kkkk", "kkkk", "kkak"]),
      5: grid([".ccc.", "ccccc", "kkkkk", "kkkkk", "kkakk"]),
      6: grid(["..cc..", "cccccc", "kkkkkk", "kkkkkk", "kkakkk", "kkakkk"]),
      8: grid(["...cc...", "..cccc..", "cccccccc", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk", "kkkkakkk", "kkkkakkk"]),
      10: grid(["....cc....", "..cccccc..", "cccccccccc", "kkkkkkkkkk", "kkkkkkkkkk", "kkkkkkkkkk", "kkkkkkkkkk", "kkkkaakkkk", "kkkkaakkkk", "kkkkaakkkk"]),
      12: grid([".....cc.....", "...cccccc...", "..cccccccc..", "cccccccccccc", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkkkkkkkk", "kkkkkaakkkkk", "kkkkkaakkkkk", "kkkkkaakkkkk"]),
      14: grid(["......cc......", "....cccccc....", "..cccccccccc..", "cccccccccccccc", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkkkkkkkkk", "kkkkkkaakkkkkk", "kkkkkkaakkkkkk", "kkkkkkaakkkkkk", "kkkkkkaakkkkkk"]),
    },
  },
  flower: {
    label: "Flower",
    grids: {
      3: grid([".p.", "psp", ".s."]),
      4: grid(["..p.", ".psp", "..s.", "..s."]),
      5: grid(["..p..", "pprpp", "pprpp", "..s..", "..s.."]),
      6: grid(["..pp..", ".pppp.", ".prrp.", "..sp..", "..sp..", "..s..."]),
      8: grid(["...pp...", "...pp...", ".pprrpp.", ".pprrpp.", "...ps...", "...ps...", "....s...", "....s..."]),
      10: grid(["...pppp...", "..pppppp..", "..pppppp..", ".ppprrppp.", ".ppprrppp.", "..ppsppp..", "..ppsppp..", "....sp....", "....s.....", "....s....."]),
      12: grid(["...pppppp...", "..pppppppp..", "..pppppppp..", ".pppprrpppp.", ".ppprrrrppp.", "..ppprrppp..", "..ppppsppp..", "..ppppsppp..", ".....ps.....", "......s.....", "......s.....", "......s....."]),
      14: grid(["....pppppp....", "...pppppppp...", "..pppppppppp..", "..pppprrpppp..", ".pppprrrrpppp.", ".pppprrrrpppp.", "..pppprrpppp..", "..ppppsppppp..", "...pppspppp...", "....ppsppp....", "......sp......", "......s.......", "......s.......", "......s......."]),
    },
  },
  cat: {
    label: "Cat",
    grids: {
      3: grid(["a.a", "aaa", ".a."]),
      4: grid(["a..a", "aaaa", "aaaa", ".aa."]),
      5: grid(["a...a", ".aaa.", "aaaaa", "aaaaa", ".aaa."]),
      6: grid([".a..a.", ".aaaa.", "..aa..", ".appa.", ".aaaa.", "..aa.."]),
      8: grid(["........", "..a..a..", ".aaaaaa.", "..aaaa..", ".aaaaaa.", ".apaapa.", "..aaaa..", "..aaaa.."]),
      10: grid(["..........", "...a..a...", ".aaaaaaaa.", "...aaaa...", "..aaaaaa..", "..aaaaaa..", "..apaapa..", "..aaaaaa..", "..aaaaaa..", "...aaaa..."]),
      12: grid(["............", "...a....a...", "...aa..aa...", "..aaaaaaaa..", "...aaaaaa...", "...aaaaaa...", "..aaaaaaaa..", "..aapaapaa..", "..aaaaaaaa..", "..aaaaaaaa..", "...aaaaaa...", ".....aa....."]),
      14: grid(["..............", "..............", "....a....a....", "...aaa..aaa...", "..aaaaaaaaaa..", "....aaaaaa....", "...aaaaaaaa...", "..aaaaaaaaaa..", "..aaapaapaaa..", "..aaaaaaaaaa..", "...aaaaaaaa...", "...aaaaaaaa...", "....aaaaaa....", "......aa......"]),
    },
  },
  dog: {
    label: "Dog",
    grids: {
      3: grid(["c.c", "ccc", ".a."]),
      4: grid(["c..c", "cccc", "cccc", ".aa."]),
      5: grid(["c...c", ".ccc.", "ccccc", "ccccc", ".aa.."]),
      6: grid(["......", "..cc..", "ccppcc", "ccaacc", "ccaacc", "cc..cc"]),
      8: grid(["........", "........", "..cccc..", ".ccppcc.", ".cccccc.", ".ccaacc.", ".ccaacc.", ".cc..cc."]),
      10: grid(["..........", "..........", "...cccc...", "..cccccc..", ".ccpccpcc.", ".cccccccc.", ".cccaaccc.", ".cccaaccc.", ".cc....cc.", ".........."]),
      12: grid(["............", "............", "....cccc....", "...cccccc...", "..cccccccc..", ".cccpccpccc.", ".cccccccccc.", ".cccaaaaccc.", ".cccaaaaccc.", ".cc.cccc.cc.", ".cc......cc.", "............"]),
      14: grid(["..............", "..............", "......cc......", "....cccccc....", "...cccccccc...", "...cccccccc...", "..cccpccpccc..", "..cccccccccc..", "..cccaaaaccc..", "..cccaaaaccc..", "..cccaaaaccc..", "..cc......cc..", "..cc......cc..", ".............."]),
    },
  },
  butterfly: {
    label: "Butterfly",
    grids: {
      3: grid(["k.k", "ksk", "r.r"]),
      4: grid(["kksk", "kksk", "rrsr", ".rr."]),
      5: grid(["kk.kk", "kkskk", "kkskk", "rrsrr", ".rsr."]),
      6: grid(["..s...", ".ks.k.", "kks.kk", ".ks.k.", ".rs.r.", ".rs.r."]),
      8: grid(["....s...", "....s...", ".kk.skk.", ".kk.skk.", ".kk.skk.", ".rr.srr.", ".rr.srr.", "....s..."]),
      10: grid(["....s.....", "....s.....", ".kkks.kkk.", ".kkks.kkk.", ".kkks.kkk.", ".kkks.kkk.", ".rrrs.rrr.", ".rrrs.rrr.", "..rrs.rr..", "....s....."]),
      12: grid(["......s.....", "......s.....", "..kk..s.kk..", ".kkkk.skkkk.", ".kkkk.skkkk.", ".kkkk.skkkk.", "..kkk.skkk..", "..rrr.srrr..", ".rrrr.srrrr.", "..rrr.srrr..", "...r..s.r...", "......s....."]),
      14: grid(["......s.......", "......s.......", "...k..s...k...", ".kkkkks.kkkkk.", ".kkkkks.kkkkk.", ".kkkkks.kkkkk.", ".kkkkks.kkkkk.", "..kkk.s..kkk..", "..rrr.s..rrr..", "..rrrrs.rrrr..", "..rrrrs.rrrr..", "..rrr.s..rrr..", "......s.......", "......s......."]),
    },
  },
  fish: {
    label: "Fish",
    grids: {
      3: grid(["k.c", "kkc", "k.c"]),
      4: grid([".kk.", "kkkc", "kkkc", ".kk."]),
      5: grid(["..k..", ".kkk.", "kkkkc", ".kkk.", "..k.."]),
      6: grid(["......", "..kk.c", ".kpkcc", ".kkkcc", "..kk.c", "......"]),
      8: grid(["........", "........", ".kkkkk.c", ".kpkkkcc", ".kkkkkcc", ".kkkkk.c", "........", "........"]),
      10: grid(["..........", "..........", "..kkkk...c", ".kkkkkk.cc", ".kkpkkkccc", ".kkkkkkccc", ".kkkkkk.cc", "..kkkk...c", "..........", ".........."]),
      12: grid(["............", "............", "....kk......", "..kkkkkk..cc", ".kkpkkkkkccc", ".kkkkkkkcccc", ".kkkkkkkcccc", ".kkkkkkkkccc", "..kkkkkk..cc", "....kk......", "............", "............"]),
      14: grid(["..............", "..............", "..............", "...kkkkkk....c", "..kkkkkkkk..cc", ".kkkpkkkkkkccc", ".kkkkkkkkkcccc", ".kkkkkkkkkcccc", ".kkkkkkkkkkccc", "..kkkkkkkk..cc", "...kkkkkk....c", "..............", "..............", ".............."]),
    },
  },
  mushroom: {
    label: "Mushroom",
    grids: {
      3: grid([".r.", ".a.", ".a."]),
      4: grid([".rr.", "rrrr", ".aa.", ".aa."]),
      5: grid(["..r..", "rrrrr", ".aaa.", ".aaa.", ".aaa."]),
      6: grid(["..rr..", ".rrrr.", ".rrrr.", "..aa..", "..aa..", "..aa.."]),
      8: grid(["...ra...", ".rarrar.", ".rrrrrr.", "...aa...", "...aa...", "...aa...", "...aa...", "...aa..."]),
      10: grid(["...rrrr...", ".rraraarr.", ".rrrrrrrr.", "..........", "...aaaa...", "...aaaa...", "...aaaa...", "...aaaa...", "...aaaa...", "...aaaa..."]),
      12: grid(["....rrrr....", "..rarrarrr..", ".rrrrrrrarr.", ".rrrrrrrrrr.", "............", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa....", "....aaaa...."]),
      14: grid([".....rrrr.....", "..rrrrrarrrr..", "..rrarrrrarr..", ".rrrrrrrrrrrr.", ".rrrrrrrrrrrr.", "..............", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa.....", ".....aaaa....."]),
    },
  },
  umbrella: {
    label: "Umbrella",
    grids: {
      3: grid([".p.", "ppp", ".c."]),
      4: grid([".pp.", "pppp", ".c..", ".c.."]),
      5: grid(["..p..", ".ppp.", "ppppp", "..c..", "..c.."]),
      6: grid(["pppppp", "......", "..c...", "..c...", "..c...", "..cc.."]),
      8: grid(["pppppppp", "pppppppp", "........", "....c...", "....c...", "....c...", "....c...", "....cc.."]),
      10: grid(["pppppppppp", ".pppppppp.", "..........", "....c.....", "....c.....", "....c.....", "....c.....", "....c.....", "....c.....", "....cc...."]),
      12: grid(["pppppppppppp", "pppppppppppp", ".pppppppppp.", "............", "......c.....", "......c.....", "......c.....", "......c.....", "......c.....", "......c.....", "......c.....", "......cc...."]),
      14: grid(["pppppppppppppp", "pppppppppppppp", ".pppppppppppp.", "..pppppppppp..", "..............", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......c.......", "......cc......"]),
    },
  },
};

const STORAGE_KEY = "ls-colour-match-state";
const SETTINGS_KEY = "ls-colour-match-settings";

let settings = {
  gridSize: 3,
  colourCount: 3,
  mode: "random", // "random" | "picture"
  picture: "sun",
};

let target = [];
let playerColours = [];
let activeColour = null;

function defaultSettings() {
  return { gridSize: 3, colourCount: 3, mode: "random", picture: "sun" };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    const base = defaultSettings();
    if (!GRID_SIZES.includes(parsed.gridSize)) parsed.gridSize = base.gridSize;
    if (!COLOUR_COUNTS.includes(parsed.colourCount)) parsed.colourCount = base.colourCount;
    if (parsed.mode !== "random" && parsed.mode !== "picture") parsed.mode = base.mode;
    if (!PICTURES[parsed.picture]) parsed.picture = base.picture;
    return { ...base, ...parsed };
  } catch (e) {
    return defaultSettings();
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, target, playerColours }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const size = settings.gridSize * settings.gridSize;
    if (
      Array.isArray(parsed.target) &&
      Array.isArray(parsed.playerColours) &&
      parsed.target.length === size &&
      parsed.playerColours.length === size
    ) {
      return parsed;
    }
  } catch (e) {
    // corrupt or missing state, fall through to a fresh pattern
  }
  return null;
}

function colourByName(name) {
  return PALETTE.find((c) => c.name === name);
}

function randomPattern() {
  const usable = PALETTE.slice(1, 1 + settings.colourCount);
  const size = settings.gridSize * settings.gridSize;
  return Array.from({ length: size }, () => usable[Math.floor(Math.random() * usable.length)].name);
}

function picturePattern() {
  const picture = PICTURES[settings.picture];
  return picture.grids[settings.gridSize].slice();
}

function generateTarget() {
  return settings.mode === "picture" ? picturePattern() : randomPattern();
}

// Colours available to paint with: eraser + whatever the current
// target actually uses (covers both random and picture modes).
function paletteForTarget() {
  const used = new Set(target);
  used.delete("empty");
  const colours = PALETTE.filter((c) => c.name === "empty" || used.has(c.name));
  return colours.length > 1 ? colours : PALETTE.slice(0, 1 + settings.colourCount);
}

// Adds the shape glyph that makes a coloured tile/swatch identifiable
// without relying on hue — a plain darker-than-fill silhouette, so it
// reads at any cell size and under any colour-vision deficiency.
function appendShapeGlyph(parent, colour) {
  if (!colour.shape) return;
  const glyph = document.createElement("span");
  glyph.className = "shape-glyph";
  glyph.style.clipPath = SHAPE_CLIP_PATHS[colour.shape];
  parent.appendChild(glyph);
}

function renderGrid(container, colours, size, { interactive }) {
  container.innerHTML = "";
  container.dataset.size = String(size);
  colours.forEach((name, i) => {
    const cell = document.createElement(interactive ? "button" : "div");
    cell.className = "cell";
    const colour = colourByName(name);
    cell.style.backgroundColor = colour.hex;
    cell.setAttribute("aria-label", interactive ? `Tile ${i + 1}, ${name}` : `${name}`);
    if (interactive) {
      cell.type = "button";
      cell.dataset.index = String(i);
    }
    appendShapeGlyph(cell, colour);
    container.appendChild(cell);
  });
}

// Guaranteed-fit layout: rather than guessing a cell size from
// viewport units (clamp/vw/vh) and hoping it happens to fit, this
// measures the real space available for the two grids and computes an
// exact pixel cell size from that — so there is never a scrollbar and
// the two grids never overlap, at any grid size (3x3 up to 14x14) or
// viewport. See notes.md ("Guaranteed-fit layout") for the full
// rationale and history (this replaced a clamp()-based approach that
// could only approximate fit, plus a horizontal-scroll fallback for
// when that approximation failed).
// Preferred minimum for a comfortably tappable interactive cell. This
// is a PREFERENCE used only to pick side-by-side vs stacked — never a
// hard floor on the final applied size. Forcing the applied size up to
// this floor regardless of the measured budget is exactly what used
// to cause overflow on very small screens (a floor-clamped cell could
// be bigger than the space actually available); see notes.md.
const MIN_INTERACTIVE_CELL = 30;
const MAX_CELL_GAP = 8; // preferred gap between cells, in style.css's .grid `gap`
const MIN_CELL_GAP = 1; // gap can shrink this far on very large grids/small screens
const ROW_GAP = 12; // must match .game-row's `gap` in style.css

// The gap between cells also has to shrink on large grids on small
// screens — at 14 columns, 13 gaps of 8px alone is 104px, which can
// exceed the entire remaining budget on a small phone even before any
// cell width is counted. Solving for an exact (cell, gap) pair
// together isn't a simple closed form once gap depends on cell size,
// so this picks a gap proportional to cell size instead (clamped to
// [MIN_CELL_GAP, MAX_CELL_GAP]) and re-solves cell size for that gap —
// two passes converge close enough in practice for a layout function
// that already re-runs on every resize.
function gapForCell(cellPx) {
  return Math.max(MIN_CELL_GAP, Math.min(MAX_CELL_GAP, Math.round(cellPx * 0.2)));
}

// A panel's own chrome (padding + border + section-label + the gap
// between the label and the grid) eats into both the width and height
// budget on top of the grid itself — measured live from the actual
// "Match this" panel's padding/border and its label's footprint,
// rather than hand-tallied from CSS values, so it stays correct if
// padding/font-size/etc. ever change. Deliberately does NOT diff
// against the grid element's own rect (panel size minus grid size) —
// that would misreport chrome as soon as the grid's tracks are 0 or
// stale (e.g. before the very first applyCellSize call).
function measurePanelChrome() {
  const panel = document.querySelector("#play-screen .panel");
  const label = panel.querySelector(".section-label");
  const panelStyle = getComputedStyle(panel);
  const panelRect = panel.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  const paddingX = (parseFloat(panelStyle.paddingLeft) || 0) + (parseFloat(panelStyle.paddingRight) || 0);
  const paddingY = (parseFloat(panelStyle.paddingTop) || 0) + (parseFloat(panelStyle.paddingBottom) || 0);
  const borderX = (parseFloat(panelStyle.borderLeftWidth) || 0) + (parseFloat(panelStyle.borderRightWidth) || 0);
  const borderY = (parseFloat(panelStyle.borderTopWidth) || 0) + (parseFloat(panelStyle.borderBottomWidth) || 0);
  const gap = parseFloat(panelStyle.rowGap || panelStyle.gap || "0") || 0;
  return {
    width: paddingX + borderX,
    height: paddingY + borderY + labelRect.height + gap,
  };
}

function cellFromBudget(size, budget, gap) {
  return (budget - gap * (size - 1)) / size;
}

function computeCellSize(size, widthBudget, heightBudget, chrome) {
  // Two grids' worth of cells (each size x size) must fit side by side
  // within widthBudget, and one grid's worth of rows must fit within
  // heightBudget — whichever of those is tighter determines cell size.
  // Two passes: solve once at the max gap, derive the gap the result
  // implies, then re-solve — converges close enough for a function
  // that re-runs on every resize anyway.
  const perPanelWidth = (widthBudget - ROW_GAP) / 2 - chrome.width;
  let gap = MAX_CELL_GAP;
  let cell = Math.min(
    cellFromBudget(size, perPanelWidth, gap),
    cellFromBudget(size, heightBudget - chrome.height, gap)
  );
  gap = gapForCell(cell);
  cell = Math.min(
    cellFromBudget(size, perPanelWidth, gap),
    cellFromBudget(size, heightBudget - chrome.height, gap)
  );
  return { cell, gap };
}

function computeStackedCellSize(size, widthBudget, heightBudget, chrome) {
  // Stacked: both grids share the full width but split the height.
  const perPanelHeight = (heightBudget - ROW_GAP) / 2 - chrome.height;
  let gap = MAX_CELL_GAP;
  let cell = Math.min(
    cellFromBudget(size, widthBudget - chrome.width, gap),
    cellFromBudget(size, perPanelHeight, gap)
  );
  gap = gapForCell(cell);
  cell = Math.min(
    cellFromBudget(size, widthBudget - chrome.width, gap),
    cellFromBudget(size, perPanelHeight, gap)
  );
  return { cell, gap };
}

function applyCellSize(container, size, cellPx, gapPx) {
  const px = `${cellPx}px`;
  container.style.gridTemplateColumns = `repeat(${size}, ${px})`;
  container.style.gridTemplateRows = `repeat(${size}, ${px})`;
  container.style.gap = `${gapPx}px`;
}

// Measures the space actually available for the game row (total
// viewport minus every other piece of play-screen chrome — header,
// how-to-play strip, palette, status text, new-pattern button, and the
// gaps between them), then decides side-by-side vs stacked from that
// real number instead of a viewport-width breakpoint guess, and
// applies an exact cell size so both grids are guaranteed to fit with
// no scrollbar and no overlap.
// The palette is chrome from the grids' point of view — its height
// eats into the same budget layoutGrids() gives the grids, same as
// the how-to-play strip or buttons. Sized here (not left at a fixed
// 44-56px) so a large colour count (up to 6 colours + eraser = 7
// swatches) doesn't force an oversized two-row palette that starves
// the grids of space on a tall/large screen. Preference: fit all
// swatches on one row at MAX_SWATCH_SIZE; if that would need more
// width than's available, shrink toward MIN_SWATCH_SIZE (still one
// row) before ever allowing a second row.
const MAX_SWATCH_SIZE = 56;
const MIN_SWATCH_SIZE = 36;
const SWATCH_GAP = 12;

// Below this much game-area content height, the palette starts
// scaling down from MAX toward MIN even when it would comfortably fit
// wider at MAX — a 56px palette is a fixed cost the grid row has to
// share space with, and on a short phone screen giving the grid a
// bigger slice matters more than the palette being at its most
// comfortable size. Chosen as roughly "small phone in portrait";
// above it the palette just uses MAX_SWATCH_SIZE as before.
const SHORT_SCREEN_HEIGHT = 700;

function sizePalette() {
  const palette = document.getElementById("palette");
  const count = palette.children.length;
  if (count === 0) return;
  // Measure against #game-area's content box, NOT the palette's own
  // parent — that wrapper div has no explicit width and shrinks to fit
  // its content (the palette itself), so reading its width here would
  // be circular: swatch size would depend on a box that only got its
  // size FROM the swatches. game-area's box doesn't depend on the
  // palette at all, so it's a stable measurement to size against.
  const gameArea = document.getElementById("game-area");
  const areaRect = gameArea.getBoundingClientRect();
  const areaStyle = getComputedStyle(gameArea);
  const areaPaddingX = (parseFloat(areaStyle.paddingLeft) || 0) + (parseFloat(areaStyle.paddingRight) || 0);
  const widthBudget = areaRect.width - areaPaddingX;
  const sizeForOneRow = (widthBudget - SWATCH_GAP * (count - 1)) / count;

  const heightScale = Math.max(0, Math.min(1, areaRect.height / SHORT_SCREEN_HEIGHT));
  const heightScaledMax = MIN_SWATCH_SIZE + (MAX_SWATCH_SIZE - MIN_SWATCH_SIZE) * heightScale;

  const size = Math.max(MIN_SWATCH_SIZE, Math.min(heightScaledMax, sizeForOneRow, MAX_SWATCH_SIZE));
  palette.style.setProperty("--swatch-size", `${Math.floor(size)}px`);
  palette.style.setProperty("--swatch-gap", `${SWATCH_GAP}px`);
}

function layoutGrids(isRetry) {
  const size = settings.gridSize;
  const playScreen = document.getElementById("play-screen");
  const gameArea = document.getElementById("game-area");
  const rowWrap = document.getElementById("game-row-wrap");
  const row = document.getElementById("game-row");
  const targetGrid = document.getElementById("target-grid");
  const playerGrid = document.getElementById("player-grid");
  if (!targetGrid.children.length || !playerGrid.children.length) return;
  // Every size measured below is 0 while play-screen is hidden (the
  // very first render() happens before showPlayScreen()/showSetupScreen()
  // has decided which screen to show) — computing against all-zero
  // measurements can wrongly conclude nothing fits and flip on compact
  // mode for no reason. showPlayScreen() always calls layoutGrids()
  // again once visible, so skipping while hidden loses nothing.
  if (playScreen.hidden) return;

  // Always re-evaluate compact mode fresh on every top-level call
  // (not a retry) — a viewport that used to need it (e.g. resized
  // from landscape-phone-small to a normal size) should be able to
  // drop back out of it, not get stuck compact forever.
  if (!isRetry) playScreen.classList.remove("play-screen--compact");

  // Size the palette BEFORE measuring the height budget below — its
  // height feeds directly into that measurement, so it needs to be at
  // its final size first (same reasoning as why chrome is measured
  // live rather than hand-tallied).
  sizePalette();

  // How much vertical space is available for game-row-wrap: the
  // game-area's own height, minus every OTHER direct child of
  // play-screen (how-to-play strip, palette, status, new-pattern
  // button) and the gaps between them — measured live via
  // getBoundingClientRect rather than hand-tallied, so this stays
  // correct if e.g. the how-to-play strip wraps to two lines on a
  // narrow screen.
  const areaRect = gameArea.getBoundingClientRect();
  const areaCompStyle = getComputedStyle(gameArea);
  const areaPaddingY =
    (parseFloat(areaCompStyle.paddingTop) || 0) + (parseFloat(areaCompStyle.paddingBottom) || 0);
  const areaContentHeight = areaRect.height - areaPaddingY;

  let usedHeight = 0;
  for (const child of playScreen.children) {
    if (child === rowWrap) continue;
    usedHeight += child.getBoundingClientRect().height;
  }
  const screenStyle = getComputedStyle(playScreen);
  const gapCount = playScreen.children.length - 1;
  const screenGap = parseFloat(screenStyle.rowGap || screenStyle.gap || "0") || 0;
  usedHeight += screenGap * Math.max(0, gapCount);
  const heightBudget = Math.max(0, areaContentHeight - usedHeight);

  const widthBudget = rowWrap.getBoundingClientRect().width;
  const chrome = measurePanelChrome();

  // Compute both orientations and prefer side-by-side when it clears
  // the comfortable-tap floor; otherwise pick whichever orientation
  // yields the LARGER cell (stacking isn't automatically better — on
  // a short-but-wide screen, side-by-side can still beat stacked even
  // below the floor). Never let a floor push the applied size past
  // what was actually measured to fit — that's what caused overflow
  // on very small screens: a floor-clamped cell size can be bigger
  // than the real budget allows. Floors are a preference for picking
  // orientation, not a lower bound on the final applied size.
  //
  // If NEITHER orientation actually fits (both compute negative/zero —
  // an extremely tight viewport for the chosen grid size), side-by-side
  // is never the answer: it needs chrome.width TWICE (one per panel)
  // plus the row gap, so it's always the more width-hungry of the two.
  // Stacking needs chrome.width once, so it degrades more gracefully
  // and is the better last resort even though both are technically
  // "impossible" at a positive cell size.
  const sideBySide = computeCellSize(size, widthBudget, heightBudget, chrome);
  const stackedFit = computeStackedCellSize(size, widthBudget, heightBudget, chrome);
  let chosen;
  let stacked;
  if (sideBySide.cell <= 0 && stackedFit.cell <= 0) {
    chosen = stackedFit;
    stacked = true;
  } else if (sideBySide.cell >= MIN_INTERACTIVE_CELL) {
    chosen = sideBySide;
    stacked = false;
  } else if (stackedFit.cell > sideBySide.cell) {
    chosen = stackedFit;
    stacked = true;
  } else {
    chosen = sideBySide;
    stacked = false;
  }
  // 160px cap keeps tiles from ballooning to absurd sizes on very
  // large/ultra-wide monitors with a small grid (e.g. 3x3) — well
  // above the old 100px ceiling so cells still grow noticeably more
  // than before to use available space, just not without limit.
  const cellPx = Math.max(1, Math.min(160, Math.floor(chosen.cell)));
  const gapPx = Math.max(MIN_CELL_GAP, Math.min(MAX_CELL_GAP, Math.floor(chosen.gap)));

  row.classList.toggle("game-row--stacked", stacked);
  applyCellSize(targetGrid, size, cellPx, gapPx);
  applyCellSize(playerGrid, size, cellPx, gapPx);

  // Correction pass: the budget above was computed from sibling sizes
  // measured BEFORE this render's DOM changes were applied (e.g. the
  // palette can gain/lose a row of swatches when colours or picture
  // mode change, which shifts how tall it renders) — so the applied
  // size can occasionally leave game-area still overflowing by a few
  // px once the browser lays out the new DOM. Re-measure after
  // applying and shrink by however many px are over, divided across
  // the grid's rows; loop (bounded) since a 1px-per-row shrink can
  // itself still leave a px or two of overflow from rounding, and
  // each iteration strictly reduces size so this is guaranteed to
  // terminate rather than oscillate.
  let correctedCell = cellPx;
  let remainingOverflow = 0;
  for (let i = 0; i < 6; i++) {
    remainingOverflow = Math.max(
      gameArea.scrollHeight - gameArea.clientHeight,
      gameArea.scrollWidth - gameArea.clientWidth
    );
    if (remainingOverflow <= 1 || correctedCell <= 1) break;
    const shrinkPerRow = Math.max(1, Math.ceil(remainingOverflow / size));
    correctedCell = Math.max(1, correctedCell - shrinkPerRow);
    applyCellSize(targetGrid, size, correctedCell, gapPx);
    applyCellSize(playerGrid, size, correctedCell, gapPx);
  }

  // Last resort: even 1px cells plus minimum gap still don't fit —
  // the surrounding chrome itself (how-to-play strip, buttons, status)
  // is too tall for this viewport (an extreme case like a 600x400
  // landscape phone), not the grids. Compact that chrome (see
  // .play-screen--compact in style.css) and redo the whole layout
  // computation once — guarded by `isRetry` so this can only ever
  // escalate one level, never loop.
  if (remainingOverflow > 1 && correctedCell <= 1 && !isRetry) {
    playScreen.classList.add("play-screen--compact");
    layoutGrids(true);
  }
}

// Drag-to-paint: press on a tile then drag across others to paint each
// one with the active colour, mouse and touch alike. Pointer capture
// keeps move events coming to the grid even once the pointer leaves
// the original tile, so we look up the tile under the pointer via
// elementFromPoint instead of relying on the move event's own target.
let isPainting = false;
let lastPaintedIndex = null;

function paintFromPointer(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const cell = el?.closest?.(".cell");
  if (!cell || cell.dataset.index === undefined) return;
  const index = Number(cell.dataset.index);
  if (index === lastPaintedIndex) return;
  lastPaintedIndex = index;
  paintTile(index);
}

function initPlayerGridDragPaint() {
  const grid = document.getElementById("player-grid");

  grid.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    isPainting = true;
    lastPaintedIndex = null;
    grid.setPointerCapture(e.pointerId);
    paintFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  });

  grid.addEventListener("pointermove", (e) => {
    if (!isPainting) return;
    paintFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  });

  function stopPainting() {
    isPainting = false;
    lastPaintedIndex = null;
  }

  grid.addEventListener("pointerup", stopPainting);
  grid.addEventListener("pointercancel", stopPainting);

  // Keyboard support: a real mouse/touch tap already paints via
  // pointerdown above, and pointerdown's preventDefault does NOT
  // suppress the click that follows it — so a plain tap would paint
  // twice if this handler also fired for it. Keyboard-activated clicks
  // (Enter/Space on a focused button) report event.detail === 0, since
  // they never go through the pointer pipeline; a real mouse click
  // reports detail >= 1. That's what distinguishes the two here.
  grid.addEventListener("click", (e) => {
    if (e.detail !== 0) return;
    const cell = e.target.closest(".cell");
    if (!cell || cell.dataset.index === undefined) return;
    paintTile(Number(cell.dataset.index));
  });
}

function renderPalette() {
  const container = document.getElementById("palette");
  container.innerHTML = "";
  const colours = paletteForTarget();
  if (activeColour === null || !colours.some((c) => c.name === activeColour)) {
    activeColour = colours.find((c) => c.name !== "empty")?.name ?? colours[0].name;
  }
  colours.forEach((colour) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch";
    if (colour.name === "empty") swatch.classList.add("swatch-eraser");
    if (colour.name === activeColour) swatch.classList.add("swatch-active");
    swatch.style.backgroundColor = colour.hex;
    const label = colour.name === "empty" ? "Eraser" : colour.name;
    swatch.setAttribute("aria-label", label);
    swatch.setAttribute("aria-pressed", String(colour.name === activeColour));
    swatch.addEventListener("click", () => selectColour(colour.name));
    appendShapeGlyph(swatch, colour);
    container.appendChild(swatch);
  });
}

function selectColour(name) {
  activeColour = name;
  renderPalette();
}

function paintTile(index) {
  playerColours[index] = activeColour;
  saveState();
  render();
  checkMatch();
}

function checkMatch() {
  const status = document.getElementById("status");
  const matched = target.every((c, i) => c === playerColours[i]);
  status.textContent = matched ? "Matched. Nicely done." : "";
}

function render() {
  renderGrid(document.getElementById("target-grid"), target, settings.gridSize, { interactive: false });
  renderGrid(document.getElementById("player-grid"), playerColours, settings.gridSize, { interactive: true });
  renderPalette();
  layoutGrids();
}

function startNewPattern() {
  target = generateTarget();
  playerColours = Array(settings.gridSize * settings.gridSize).fill("empty");
  activeColour = null;
  saveState();
  render();
  document.getElementById("status").textContent = "";
}

// --- Settings panel ---

function buildSegmented(container, options, current, onSelect) {
  container.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "segment";
    btn.textContent = opt.label;
    if (opt.value === current) btn.classList.add("segment-active");
    btn.setAttribute("aria-pressed", String(opt.value === current));
    btn.addEventListener("click", () => onSelect(opt.value));
    container.appendChild(btn);
  });
}

// Renders the settings controls into a given set of element ids — used
// for both the setup screen (prefix "") and the in-play menu drawer
// (prefix "menu-") so the two share one rendering path instead of
// duplicating this logic.
function renderSettingsControls(ids) {
  buildSegmented(
    document.getElementById(ids.size),
    GRID_SIZES.map((n) => ({ label: `${n}×${n}`, value: n })),
    settings.gridSize,
    (value) => updateSetting("gridSize", value)
  );

  buildSegmented(
    document.getElementById(ids.colourCount),
    COLOUR_COUNTS.map((n) => ({ label: String(n), value: n })),
    settings.colourCount,
    (value) => updateSetting("colourCount", value)
  );

  buildSegmented(
    document.getElementById(ids.mode),
    [
      { label: "Random", value: "random" },
      { label: "Picture", value: "picture" },
    ],
    settings.mode,
    (value) => updateSetting("mode", value)
  );

  const pictureRow = document.getElementById(ids.pictureRow);
  pictureRow.hidden = settings.mode !== "picture";
  buildSegmented(
    document.getElementById(ids.picture),
    Object.entries(PICTURES).map(([value, p]) => ({ label: p.label, value })),
    settings.picture,
    (value) => updateSetting("picture", value)
  );
}

function renderSettingsPanel() {
  renderSettingsControls({
    size: "size-options",
    colourCount: "colour-count-options",
    mode: "mode-options",
    pictureRow: "picture-row",
    picture: "picture-options",
  });
}

function renderMenuDrawer() {
  renderSettingsControls({
    size: "menu-size-options",
    colourCount: "menu-colour-count-options",
    mode: "menu-mode-options",
    pictureRow: "menu-picture-row",
    picture: "menu-picture-options",
  });
}

// Settings can be changed from two places: the setup screen (before a
// game starts — takes effect on next Play, no live grid behind it) and
// the in-play menu drawer (settings changed while a game is already in
// progress — takes effect immediately by regenerating the pattern, since
// there's a real grid on screen for the player to see react).
function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
  renderSettingsPanel();
  renderMenuDrawer();
  if (!document.getElementById("play-screen").hidden) {
    startNewPattern();
  }
}

// --- Menu drawer (in-play settings) ---

function openMenuDrawer() {
  renderMenuDrawer();
  const drawer = document.getElementById("menu-drawer");
  const backdrop = document.getElementById("menu-backdrop");
  drawer.hidden = false;
  backdrop.hidden = false;
  // Force layout before adding the transition-triggering class, so the
  // slide-in actually animates instead of snapping straight to open
  // (toggling a transform-affecting class in the same tick it becomes
  // visible can get coalesced by the browser into one paint).
  void drawer.offsetWidth;
  drawer.classList.add("menu-drawer--open");
  backdrop.classList.add("menu-backdrop--visible");
  document.getElementById("menu-btn").setAttribute("aria-expanded", "true");
}

function closeMenuDrawer() {
  const drawer = document.getElementById("menu-drawer");
  const backdrop = document.getElementById("menu-backdrop");
  drawer.classList.remove("menu-drawer--open");
  backdrop.classList.remove("menu-backdrop--visible");
  document.getElementById("menu-btn").setAttribute("aria-expanded", "false");
  const hide = () => {
    drawer.hidden = true;
    backdrop.hidden = true;
  };
  // Match the CSS transition duration so the drawer/backdrop stay
  // visible (and hittable) throughout the slide-out instead of
  // vanishing instantly.
  window.setTimeout(hide, 220);
}

function toggleHowToPlay() {
  const strip = document.getElementById("how-to-play");
  const btn = document.getElementById("how-to-play-btn");
  const open = strip.hidden;
  strip.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
  // The strip's height feeds into layoutGrids()'s chrome measurement —
  // showing/hiding it changes how much vertical space the grids get.
  layoutGrids();
}

// --- Screen navigation ---

function showSetupScreen() {
  document.getElementById("setup-screen").hidden = false;
  document.getElementById("play-screen").hidden = true;
}

function showPlayScreen() {
  document.getElementById("setup-screen").hidden = true;
  document.getElementById("play-screen").hidden = false;
  // layoutGrids() measures real element sizes, which are all 0 while
  // play-screen has `hidden` set — re-run it now that the screen (and
  // therefore every size it depends on) is actually visible.
  layoutGrids();
}

function startGame() {
  startNewPattern();
  showPlayScreen();
}

function init() {
  settings = loadSettings();
  const saved = loadState();
  const resuming = saved && JSON.stringify(saved.settings) === JSON.stringify(settings);
  if (resuming) {
    target = saved.target;
    playerColours = saved.playerColours;
  } else {
    target = generateTarget();
    playerColours = Array(settings.gridSize * settings.gridSize).fill("empty");
  }
  renderSettingsPanel();
  render();
  checkMatch();

  document.getElementById("play-btn").addEventListener("click", startGame);
  document.getElementById("menu-btn").addEventListener("click", openMenuDrawer);
  document.getElementById("menu-close-btn").addEventListener("click", closeMenuDrawer);
  document.getElementById("menu-backdrop").addEventListener("click", closeMenuDrawer);
  document.getElementById("how-to-play-btn").addEventListener("click", toggleHowToPlay);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("menu-drawer").classList.contains("menu-drawer--open")) {
      closeMenuDrawer();
    }
  });
  document.getElementById("new-pattern-btn").addEventListener("click", startNewPattern);
  initPlayerGridDragPaint();
  window.addEventListener("resize", () => {
    if (!document.getElementById("play-screen").hidden) layoutGrids();
  });

  if (resuming) {
    showPlayScreen();
  } else {
    showSetupScreen();
  }
}

init();
