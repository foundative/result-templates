"use client";

// A one-button arcade game on a canvas. No engine, no dependency, one file.
//
// The loop is deliberately simple: everything is drawn from `world`, which is a
// plain object held in a ref rather than in state. React re-rendering sixty
// times a second would be the slowest possible way to run a game, so the
// canvas is drawn imperatively and React only hears about the score and the
// game ending.

import { useCallback, useEffect, useRef, useState } from "react";

// The playfield is a fixed size and the canvas is scaled to fit. That way the
// game plays identically on a phone and a monitor, instead of being easier on a
// bigger screen.
const WIDTH = 360;
const HEIGHT = 560;

const GRAVITY = 1500; // pixels per second squared
const FLAP = -430; // instant upward velocity, pixels per second
const SPEED = 165; // how fast the world moves left
const GAP = 165; // vertical gap between pipes
const PIPE_WIDTH = 62;
const PIPE_EVERY = 1.45; // seconds
const BIRD_X = 96;
const BIRD_R = 13;

type Pipe = { x: number; top: number; passed: boolean };

type World = {
  y: number;
  velocity: number;
  pipes: Pipe[];
  since: number;
  score: number;
  over: boolean;
  started: boolean;
};

function freshWorld(): World {
  return {
    y: HEIGHT / 2,
    velocity: 0,
    pipes: [],
    since: 0,
    score: 0,
    over: false,
    started: false,
  };
}

export function Game({
  accent,
  onGameOver,
}: {
  readonly accent: string;
  readonly onGameOver: (score: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(freshWorld());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);

  const flap = useCallback(() => {
    const world = worldRef.current;
    if (world.over) {
      const restarted = freshWorld();
      restarted.started = true;
      // The tap that restarts is also a tap. Without this the new round begins
      // at velocity zero, so the bird drops out of the sky and the player has
      // to tap a second time for a reason nothing on screen explains.
      restarted.velocity = FLAP;
      worldRef.current = restarted;
      setScore(0);
      setOver(false);
      setStarted(true);
      return;
    }
    world.started = true;
    world.velocity = FLAP;
    setStarted(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    let last = performance.now();

    const step = (now: number) => {
      // Clamped, because a backgrounded tab hands back a delta of several
      // seconds and the bird would teleport through a pipe on the first frame.
      const delta = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const world = worldRef.current;

      if (world.started && !world.over) {
        world.velocity += GRAVITY * delta;
        world.y += world.velocity * delta;
        world.since += delta;

        if (world.since > PIPE_EVERY) {
          world.since = 0;
          const margin = 70;
          world.pipes.push({
            x: WIDTH,
            top: margin + Math.random() * (HEIGHT - GAP - margin * 2),
            passed: false,
          });
        }

        for (const pipe of world.pipes) {
          pipe.x -= SPEED * delta;
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.passed = true;
            world.score += 1;
            setScore(world.score);
          }
        }
        world.pipes = world.pipes.filter((pipe) => pipe.x > -PIPE_WIDTH);

        const hitGround = world.y + BIRD_R > HEIGHT || world.y - BIRD_R < 0;
        const hitPipe = world.pipes.some(
          (pipe) =>
            BIRD_X + BIRD_R > pipe.x &&
            BIRD_X - BIRD_R < pipe.x + PIPE_WIDTH &&
            (world.y - BIRD_R < pipe.top || world.y + BIRD_R > pipe.top + GAP),
        );
        if (hitGround || hitPipe) {
          world.over = true;
          setOver(true);
          onGameOver(world.score);
        }
      }

      draw(context, world, accent);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [accent, onGameOver]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        // Or the page scrolls under the game every time you jump.
        event.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  return (
    <div className="relative w-full">
      <canvas
        aria-label="Press space or tap to fly"
        className="w-full touch-none rounded-3xl border border-line bg-surface"
        height={HEIGHT}
        // Pointer, not click: on a phone a click fires after a delay long
        // enough to lose the game while waiting for it.
        onPointerDown={(event) => {
          event.preventDefault();
          flap();
        }}
        ref={canvasRef}
        width={WIDTH}
      />
      <p className="pointer-events-none absolute top-5 left-0 w-full text-center font-mono text-3xl">
        {score}
      </p>
      {!started || over ? (
        <p className="pointer-events-none absolute bottom-8 left-0 w-full text-center text-sm text-muted">
          {over ? "Tap to play again" : "Tap or press space to fly"}
        </p>
      ) : null}
    </div>
  );
}

function draw(
  context: CanvasRenderingContext2D,
  world: World,
  accent: string,
): void {
  context.clearRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = accent;
  for (const pipe of world.pipes) {
    context.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
    context.fillRect(
      pipe.x,
      pipe.top + GAP,
      PIPE_WIDTH,
      HEIGHT - pipe.top - GAP,
    );
  }

  // Tilting with the velocity is the whole character of the thing. Clamped, or
  // a long fall spins it past vertical.
  const tilt = Math.max(-0.5, Math.min(1.1, world.velocity / 700));
  context.save();
  context.translate(BIRD_X, world.y);
  context.rotate(tilt);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = accent;
  context.beginPath();
  context.arc(5, -4, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
