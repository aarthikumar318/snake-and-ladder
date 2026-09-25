import { useState, useRef, useEffect, useCallback } from "react";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, Crown, Sparkles } from "lucide-react";

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

const LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
const SNAKES = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };

const PALETTE = [
  { name: "Coral", main: "#E15B3F", dark: "#A93F29" },
  { name: "Teal", main: "#218C7A", dark: "#155E52" },
  { name: "Marigold", main: "#D9962D", dark: "#9C6B18" },
  { name: "Plum", main: "#7A5A9E", dark: "#52396E" },
];

function numberAt(displayRow, col) {
  const row0 = 9 - displayRow;
  return row0 % 2 === 0 ? row0 * 10 + col + 1 : row0 * 10 + (9 - col) + 1;
}

function cellCenter(n) {
  const row0 = Math.floor((n - 1) / 10);
  const col0 = (n - 1) % 10;
  const col = row0 % 2 === 0 ? col0 : 9 - col0;
  const displayRow = 9 - row0;
  return { x: col * 10 + 5, y: displayRow * 10 + 5 };
}

const CELLS = [];
for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) CELLS.push(numberAt(r, c));

function SnakePath({ from, to, color }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const mx = (a.x + b.x) / 2 + (a.x > b.x ? 6 : -6);
  const my = (a.y + b.y) / 2;
  const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
  const angle = (Math.atan2(b.y - my, b.x - mx) * 180) / Math.PI;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <path d={d} fill="none" stroke="#00000022" strokeWidth="1.6" strokeDasharray="0.1 2.6" strokeLinecap="round" />
      <circle cx={a.x} cy={a.y} r="2.1" fill={color} />
      <circle cx={a.x - 0.6} cy={a.y - 0.5} r="0.35" fill="#1c1710" />
      <circle cx={a.x + 0.7} cy={a.y - 0.5} r="0.35" fill="#1c1710" />
      <polygon points="0,-0.9 1.6,0 0,0.9" fill={color} transform={`translate(${b.x} ${b.y}) rotate(${angle})`} />
    </g>
  );
}

function LadderPath({ from, to, color }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len, ny = dx / len;
  const off = 1.4;
  const rails = [
    [a.x + nx * off, a.y + ny * off, b.x + nx * off, b.y + ny * off],
    [a.x - nx * off, a.y - ny * off, b.x - nx * off, b.y - ny * off],
  ];
  const rungs = [];
  const steps = Math.max(3, Math.floor(len / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    rungs.push([
      a.x + nx * off + dx * t, a.y + ny * off + dy * t,
      a.x - nx * off + dx * t, a.y - ny * off + dy * t,
    ]);
  }
  return (
    <g opacity="0.95">
      {rails.map((r, i) => (
        <line key={i} x1={r[0]} y1={r[1]} x2={r[2]} y2={r[3]} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      ))}
      {rungs.map((r, i) => (
        <line key={i} x1={r[0]} y1={r[1]} x2={r[2]} y2={r[3]} stroke={color} strokeWidth="0.8" strokeLinecap="round" />
      ))}
    </g>
  );
}

export default function SnakeAndLadder() {
  const [phase, setPhase] = useState("setup");
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["", "", "", ""]);
  const [players, setPlayers] = useState([]);
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [log, setLog] = useState([]);
  const [winner, setWinner] = useState(null);
  const rollTimer = useRef(null);
  const turnRef = useRef(0);

  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);

  useEffect(() => () => clearTimeout(rollTimer.current), []);

  const startGame = () => {
    const ps = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: names[i].trim() || `Player ${i + 1}`,
      color: PALETTE[i],
      pos: 0,
    }));
    setPlayers(ps);
    setTurn(0);
    setLog([`${ps[0].name} rolls first.`]);
    setWinner(null);
    setPhase("playing");
  };

  const pushLog = (msg) => setLog((l) => [msg, ...l].slice(0, 6));

  const rollDice = useCallback(() => {
    if (rolling || phase !== "playing") return;
    setRolling(true);
    let ticks = 0;
    const spin = setInterval(() => {
      setDice(1 + Math.floor(Math.random() * 6));
      ticks++;
      if (ticks > 9) {
        clearInterval(spin);
        const final = 1 + Math.floor(Math.random() * 6);
        setDice(final);
        settleMove(final);
      }
    }, 70);
  }, [rolling, phase]);

  const settleMove = (value) => {
    const activeIndex = turnRef.current;
    setPlayers((prev) => {
      const current = prev[activeIndex];
      let target = current.pos + value;
      let bounced = false;
      if (target > 100) {
        target = current.pos;
        bounced = true;
      }
      const landed = target;
      const final = LADDERS[target] || SNAKES[target] || target;

      if (bounced) {
        pushLog(`${current.name} rolled a ${value} — needs an exact roll to finish.`);
      } else if (LADDERS[target]) {
        pushLog(`${current.name} rolled a ${value}, climbed a ladder to ${final}!`);
      } else if (SNAKES[target]) {
        pushLog(`${current.name} rolled a ${value}, bitten by a snake down to ${final}.`);
      } else {
        pushLog(`${current.name} rolled a ${value} and moved to ${final}.`);
      }

      const next = prev.map((p, i) => (i === activeIndex ? { ...p, pos: landed } : p));

      setTimeout(() => {
        setPlayers((p2) => p2.map((p, i) => (i === activeIndex ? { ...p, pos: final } : p)));
        setRolling(false);
        if (final === 100) {
          setWinner(current);
          setPhase("won");
        } else {
          setTurn((t) => (value === 6 ? t : (t + 1) % prev.length));
        }
      }, LADDERS[target] || SNAKES[target] ? 480 : 60);

      return next;
    });
  };

  const resetAll = () => {
    setPhase("setup");
    setPlayers([]);
    setLog([]);
    setWinner(null);
    setDice(1);
  };

  const DiceIcon = DICE_ICONS[dice - 1];
  const leaderPos = players.length ? Math.max(...players.map((p) => p.pos)) : 0;

  const occupants = {};
  players.forEach((p) => {
    if (!occupants[p.pos]) occupants[p.pos] = [];
    occupants[p.pos].push(p);
  });

  return (
    <div className="sl-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap');

        .sl-root {
          --cream: #EDE3CB;
          --cream-alt: #E1D3AD;
          --ink: #2A2113;
          --forest: #1F5C4B;
          --rust: #A93F29;
          --gold: #C99A3C;
          --paper: #F7EFDC;
          font-family: 'Inter', sans-serif;
          color: var(--ink);
          min-height: 100vh;
          background: radial-gradient(circle at 20% 10%, #3B3222 0%, #241D13 55%, #1A150D 100%);
          padding: 28px 16px 48px;
          box-sizing: border-box;
        }
        .sl-root * { box-sizing: border-box; }

        .sl-shell { max-width: 980px; margin: 0 auto; }

        .sl-header { text-align: center; margin-bottom: 22px; }
        .sl-title {
          font-family: 'Baloo 2', sans-serif;
          font-weight: 800;
          font-size: clamp(32px, 5vw, 46px);
          color: var(--paper);
          letter-spacing: 0.5px;
          margin: 0;
          text-shadow: 0 3px 0 #00000055;
        }
        .sl-subtitle {
          color: #D8CBAA;
          font-size: 15px;
          margin-top: 6px;
          font-weight: 500;
        }

        /* ---------- Setup screen ---------- */
        .sl-setup-card {
          background: var(--paper);
          border-radius: 22px;
          padding: 32px;
          max-width: 480px;
          margin: 0 auto;
          box-shadow: 0 20px 45px -18px #00000090, inset 0 0 0 1px #ffffff40;
        }
        .sl-label {
          font-weight: 700;
          font-size: 13px;
          color: var(--forest);
          margin-bottom: 10px;
        }
        .sl-count-row { display: flex; gap: 10px; margin-bottom: 24px; }
        .sl-count-btn {
          flex: 1;
          padding: 12px 0;
          border-radius: 12px;
          border: 2px solid #C9BC98;
          background: #fff8ea;
          font-family: 'Baloo 2', sans-serif;
          font-weight: 700;
          font-size: 18px;
          color: var(--ink);
          cursor: pointer;
          transition: transform 0.12s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .sl-count-btn:hover { transform: translateY(-2px); }
        .sl-count-btn.active {
          border-color: var(--forest);
          background: var(--forest);
          color: #fff;
        }
        .sl-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .sl-swatch {
          width: 30px; height: 30px; border-radius: 50%;
          flex-shrink: 0;
          box-shadow: inset 0 -3px 0 #00000030, 0 2px 4px #00000040;
        }
        .sl-name-input {
          flex: 1;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1.5px solid #C9BC98;
          background: #fff;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
        }
        .sl-name-input:focus { border-color: var(--forest); }
        .sl-start-btn {
          width: 100%;
          margin-top: 18px;
          padding: 14px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(180deg, var(--rust), #8E3421);
          color: #fff;
          font-family: 'Baloo 2', sans-serif;
          font-weight: 700;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 6px 0 #6E2717, 0 10px 18px -6px #00000070;
          transition: transform 0.08s ease;
        }
        .sl-start-btn:active { transform: translateY(4px); box-shadow: 0 2px 0 #6E2717; }

        /* ---------- Game layout ---------- */
        .sl-game { display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; align-items: flex-start; }

        .sl-board-wrap {
          flex: 1 1 480px;
          max-width: 620px;
          background: linear-gradient(160deg, #6B4B2A, #4A3218);
          padding: 14px;
          border-radius: 20px;
          box-shadow: 0 25px 50px -20px #00000090;
        }
        .sl-board {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(10, 1fr);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: inset 0 0 0 3px #3A2712;
        }
        .sl-cell {
          position: relative;
          background: var(--cream);
          font-size: clamp(7px, 1.4vw, 11px);
          font-weight: 600;
          color: #7A6A47;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 3px 4px;
        }
        .sl-cell.alt { background: var(--cream-alt); }
        .sl-cell.goal { background: var(--gold); color: #5A420F; }
        .sl-cell.start { background: #C9DAC7; color: #2E4A2C; }
        .sl-overlay { position: absolute; inset: 0; pointer-events: none; }

        .sl-tokens {
          position: absolute;
          width: 7%;
          height: 7%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: left 0.45s cubic-bezier(.34,1.4,.64,1), top 0.45s cubic-bezier(.34,1.4,.64,1);
        }
        .sl-token {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 2px 5px #00000060;
        }

        /* ---------- Sidebar ---------- */
        .sl-side { flex: 0 1 300px; display: flex; flex-direction: column; gap: 16px; }

        .sl-turn-card {
          background: var(--paper);
          border-radius: 18px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 14px 30px -14px #00000080;
        }
        .sl-turn-label { font-size: 12px; font-weight: 700; color: #8A7A54; letter-spacing: 0.3px; }
        .sl-turn-name {
          font-family: 'Baloo 2', sans-serif;
          font-weight: 800;
          font-size: 24px;
          margin: 4px 0 16px;
        }
        .sl-dice-btn {
          border: none;
          background: none;
          cursor: pointer;
          margin: 0 auto;
          display: block;
          padding: 0;
        }
        .sl-dice-face {
          width: 76px; height: 76px;
          border-radius: 16px;
          background: linear-gradient(160deg, #fffdf6, #EFE3C4);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 0 #C9B87F, 0 12px 20px -6px #00000060;
          transition: transform 0.08s ease;
        }
        .sl-dice-btn:active .sl-dice-face:not(.disabled) { transform: translateY(6px); box-shadow: 0 2px 0 #C9B87F; }
        .sl-dice-face.disabled { opacity: 0.55; }
        .sl-roll-hint { margin-top: 10px; font-size: 13px; color: #8A7A54; font-weight: 600; }

        .sl-players-card {
          background: var(--paper);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 14px 30px -14px #00000080;
        }
        .sl-players-title { font-size: 12px; font-weight: 700; color: #8A7A54; margin-bottom: 10px; }
        .sl-player-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 8px;
          border-radius: 10px;
          margin-bottom: 4px;
        }
        .sl-player-row.active { background: #FFF3D8; box-shadow: inset 0 0 0 1.5px #E8C978; }
        .sl-dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px #00000050; flex-shrink: 0; }
        .sl-player-name { flex: 1; font-weight: 600; font-size: 14px; }
        .sl-player-pos { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 15px; color: #6B5B38; }

        .sl-log-card {
          background: #241D13;
          border-radius: 18px;
          padding: 16px;
          color: #D8CBAA;
          font-size: 13px;
          box-shadow: 0 14px 30px -14px #00000080;
        }
        .sl-log-title { font-size: 12px; font-weight: 700; color: #A79564; margin-bottom: 8px; }
        .sl-log-item { padding: 5px 0; border-top: 1px solid #3A311F; line-height: 1.4; }
        .sl-log-item:first-child { border-top: none; }

        .sl-reset-link {
          background: none; border: none; color: #C9BC98; font-size: 13px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 4px auto 0;
        }
        .sl-reset-link:hover { color: #fff; }

        /* ---------- Win overlay ---------- */
        .sl-win-backdrop {
          position: fixed; inset: 0; background: #1A150Dcc;
          display: flex; align-items: center; justify-content: center; z-index: 50;
          padding: 20px;
        }
        .sl-win-card {
          background: var(--paper); border-radius: 22px; padding: 36px 32px;
          text-align: center; max-width: 360px;
          box-shadow: 0 30px 60px -20px #000000a0;
        }
        .sl-win-name {
          font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 28px;
          margin: 10px 0 4px;
        }
        .sl-win-sub { color: #8A7A54; font-size: 14px; margin-bottom: 22px; }

        @media (max-width: 640px) {
          .sl-game { flex-direction: column; align-items: stretch; }
          .sl-side { flex: 1 1 auto; }
        }
      `}</style>

      <div className="sl-shell">
        <div className="sl-header">
          <h1 className="sl-title">Snake &amp; Ladder</h1>
          <div className="sl-subtitle">Roll a six to go again. First to square 100 wins.</div>
        </div>

        {phase === "setup" && (
          <div className="sl-setup-card">
            <div className="sl-label">How many players?</div>
            <div className="sl-count-row">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  className={`sl-count-btn ${count === n ? "active" : ""}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="sl-label">Names</div>
            {Array.from({ length: count }).map((_, i) => (
              <div className="sl-name-row" key={i}>
                <div className="sl-swatch" style={{ background: PALETTE[i].main }} />
                <input
                  className="sl-name-input"
                  placeholder={`Player ${i + 1}`}
                  value={names[i]}
                  maxLength={16}
                  onChange={(e) => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setNames(next);
                  }}
                />
              </div>
            ))}

            <button className="sl-start-btn" onClick={startGame}>Start game</button>
          </div>
        )}

        {(phase === "playing" || phase === "won") && (
          <div className="sl-game">
            <div className="sl-board-wrap">
              <div className="sl-board">
                {CELLS.map((n, idx) => {
                  const r = Math.floor(idx / 10);
                  const c = idx % 10;
                  const alt = (r + c) % 2 === 1;
                  return (
                    <div
                      key={idx}
                      className={`sl-cell ${alt ? "alt" : ""} ${n === 100 ? "goal" : ""} ${n === 1 ? "start" : ""}`}
                    >
                      {n}
                    </div>
                  );
                })}

                <svg className="sl-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {Object.entries(LADDERS).map(([from, to]) => (
                    <LadderPath key={`l${from}`} from={Number(from)} to={to} color="#2F6B4E" />
                  ))}
                  {Object.entries(SNAKES).map(([from, to]) => (
                    <SnakePath key={`s${from}`} from={Number(from)} to={to} color="#A93F29" />
                  ))}
                </svg>

                {Object.entries(occupants).map(([pos, ps]) => {
                  const p0 = Number(pos);
                  const center = p0 === 0 ? { x: -6, y: 102 } : cellCenter(p0);
                  return ps.map((p, i) => {
                    const spread = ps.length > 1 ? (i - (ps.length - 1) / 2) * 2.4 : 0;
                    return (
                      <div
                        key={p.id}
                        className="sl-tokens"
                        style={{ left: `${center.x + spread - 3.5}%`, top: `${center.y - 3.5}%` }}
                      >
                        <div className="sl-token" style={{ background: p.color.main }} />
                      </div>
                    );
                  });
                })}
              </div>
            </div>

            <div className="sl-side">
              <div className="sl-turn-card">
                <div className="sl-turn-label">Now rolling</div>
                <div className="sl-turn-name" style={{ color: players[turn]?.color.dark }}>
                  {players[turn]?.name}
                </div>
                <button
                  className="sl-dice-btn"
                  onClick={rollDice}
                  disabled={rolling || phase !== "playing"}
                  aria-label="Roll dice"
                >
                  <div className={`sl-dice-face ${rolling ? "disabled" : ""}`}>
                    <DiceIcon size={40} color="#4A3218" />
                  </div>
                </button>
                <div className="sl-roll-hint">
                  {rolling ? "Rolling…" : dice === 6 ? "Six! Tap to roll again." : "Tap the die to roll"}
                </div>
              </div>

              <div className="sl-players-card">
                <div className="sl-players-title">Players</div>
                {players.map((p, i) => (
                  <div key={p.id} className={`sl-player-row ${i === turn ? "active" : ""}`}>
                    <div className="sl-dot" style={{ background: p.color.main }} />
                    <div className="sl-player-name">{p.name}</div>
                    {p.pos === leaderPos && p.pos > 0 && <Crown size={14} color="#C99A3C" />}
                    <div className="sl-player-pos">{p.pos}</div>
                  </div>
                ))}
              </div>

              <div className="sl-log-card">
                <div className="sl-log-title">Play by play</div>
                {log.length === 0 && <div className="sl-log-item">The board is set — good luck!</div>}
                {log.map((l, i) => (
                  <div className="sl-log-item" key={i}>{l}</div>
                ))}
              </div>

              <button className="sl-reset-link" onClick={resetAll}>
                <RotateCcw size={13} /> New game
              </button>
            </div>
          </div>
        )}
      </div>

      {phase === "won" && winner && (
        <div className="sl-win-backdrop">
          <div className="sl-win-card">
            <Sparkles size={30} color={winner.color.main} />
            <div className="sl-win-name" style={{ color: winner.color.dark }}>{winner.name} wins!</div>
            <div className="sl-win-sub">Reached square 100 first.</div>
            <button className="sl-start-btn" onClick={resetAll}>Play again</button>
          </div>
        </div>
      )}
    </div>
  );
}
