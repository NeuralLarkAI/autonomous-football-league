import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { prisma } from "@afl/db";
import { DefenseCallSchema, OffenseCallSchema } from "@afl/core";

const QUARTER_SECONDS = 15 * 60;
const GAME_ENGINE_VERSION = "engine@0.1.0";
const COACH_TIMEOUT_MS = 30;

type RuntimeState = {
  qtr: number;
  timeSeconds: number;
  down: number;
  distance: number;
  yardLine: number;
  offenseTeamId: string;
  defenseTeamId: string;
  driveNumber: number;
  scoreHome: number;
  scoreAway: number;
};

type OffenseCall = ReturnType<typeof OffenseCallSchema.parse>;
type DefenseCall = ReturnType<typeof DefenseCallSchema.parse>;

type CoachContext = {
  qtr: number;
  timeSeconds: number;
  down: number;
  distance: number;
  yardLine: number;
  offenseScore: number;
  defenseScore: number;
  driveNumber: number;
  playNumber: number;
};

type TeamInfo = {
  id: string;
  shortName: string;
  schemeOffense: "WEST_COAST" | "SPREAD" | "POWER" | "VERTICAL";
  schemeDefense: "MAN" | "ZONE" | "BLITZ" | "SHELL";
  coachSubmission?: {
    id: string;
    filePath: string;
  };
};

const sourceCache = new Map<string, string>();

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function normalizeCoachSource(source: string): string {
  let src = source;
  src = src.replace(/export\s+async\s+function\s+decide/g, "async function decide");
  src = src.replace(/export\s+function\s+decide/g, "function decide");
  src = src.replace(/export\s+const\s+decide\s*=\s*/g, "const decide = ");
  src += "\n;globalThis.__aflDecide = (typeof decide === 'function' ? decide : (module?.exports?.decide ?? exports?.decide));\n";
  return src;
}

async function executeCoachSubmission(sourceCode: string, payload: unknown, seed: number): Promise<unknown> {
  const deterministicRandom = mulberry32(seed);
  const sandbox = {
    module: { exports: {} as Record<string, unknown> },
    exports: {} as Record<string, unknown>,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math: { ...Math, random: deterministicRandom },
    JSON,
    Date,
    setTimeout: undefined,
    setInterval: undefined,
    fetch: undefined,
    require: undefined,
    process: undefined,
  };
  vm.createContext(sandbox);
  const script = new vm.Script(normalizeCoachSource(sourceCode), { filename: "coach-submission.js" });
  script.runInContext(sandbox, { timeout: COACH_TIMEOUT_MS });
  const decide = (sandbox as { __aflDecide?: unknown }).__aflDecide;
  if (typeof decide !== "function") return null;
  return Promise.race([
    Promise.resolve((decide as (arg: unknown) => unknown)(payload)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Coach timeout")), COACH_TIMEOUT_MS)),
  ]);
}

async function loadSubmissionSource(submissionId: string, filePath: string): Promise<string | null> {
  if (sourceCache.has(submissionId)) return sourceCache.get(submissionId)!;
  const absolutePath = path.resolve(process.cwd(), filePath);
  try {
    const source = await fs.readFile(absolutePath, "utf8");
    sourceCache.set(submissionId, source);
    return source;
  } catch {
    return null;
  }
}

function defaultOffenseCall(team: TeamInfo, ctx: CoachContext, rng: () => number): OffenseCall {
  const runHeavy = team.schemeOffense === "POWER";
  const vertical = team.schemeOffense === "VERTICAL";
  const hurry = ctx.qtr === 4 && ctx.timeSeconds < 180;
  const concepts = runHeavy
    ? ["INSIDE_ZONE", "POWER", "COUNTER", "PLAY_ACTION"]
    : vertical
      ? ["FOUR_VERTS", "PA_SHOT", "POST_DIG", "SLANTS"]
      : team.schemeOffense === "SPREAD"
        ? ["BUBBLE", "MESH", "STICK", "OUTSIDE_ZONE"]
        : ["SLANTS", "STICK", "FLOOD", "INSIDE_ZONE"];
  const concept = concepts[randomInt(rng, 0, concepts.length - 1)]
    .replace("PLAY_ACTION", "PA_SHOT") as ReturnType<typeof OffenseCallSchema.parse>["concept"];
  return {
    personnel: (["11", "12", "21"] as const)[randomInt(rng, 0, 2)],
    concept,
    aggression: clamp(0.35 + (hurry ? 0.25 : 0) + rng() * 0.35, 0, 1),
    tempo: hurry ? "HURRY" : "NORMAL",
  };
}

function defaultDefenseCall(team: TeamInfo, ctx: CoachContext, rng: () => number): DefenseCall {
  const obviousPass = ctx.down >= 3 && ctx.distance >= 7;
  const pressure =
    team.schemeDefense === "BLITZ" || obviousPass
      ? (rng() < 0.55 ? "BLITZ" : "SIM")
      : (rng() < 0.7 ? "NONE" : "SIM");
  const coverage =
    team.schemeDefense === "MAN"
      ? "C1"
      : team.schemeDefense === "ZONE"
        ? (rng() < 0.5 ? "C3" : "C2")
        : team.schemeDefense === "SHELL"
          ? (rng() < 0.5 ? "C4" : "C2")
          : (rng() < 0.5 ? "MATCH" : "C1");
  return {
    front: obviousPass ? (rng() < 0.4 ? "DIME" : "NICKEL") : (rng() < 0.5 ? "BASE" : "NICKEL"),
    coverage: coverage as DefenseCall["coverage"],
    pressure: pressure as DefenseCall["pressure"],
    contain: clamp(0.3 + rng() * 0.6, 0, 1),
  };
}

async function chooseOffenseCall(team: TeamInfo, ctx: CoachContext, seed: number): Promise<OffenseCall> {
  const rng = mulberry32(seed);
  if (!team.coachSubmission) return defaultOffenseCall(team, ctx, rng);
  const source = await loadSubmissionSource(team.coachSubmission.id, team.coachSubmission.filePath);
  if (!source) return defaultOffenseCall(team, ctx, rng);

  try {
    const raw = await executeCoachSubmission(
      source,
      {
        mode: "GAMEPLAY_OFFENSE",
        game: ctx,
        allowedConcepts: OffenseCallSchema.shape.concept.options,
      },
      seed
    );
    const candidate =
      (raw as { offenseCall?: unknown })?.offenseCall ??
      (raw as { call?: unknown })?.call ??
      raw;
    const parsed = OffenseCallSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  return defaultOffenseCall(team, ctx, rng);
}

async function chooseDefenseCall(team: TeamInfo, ctx: CoachContext, seed: number): Promise<DefenseCall> {
  const rng = mulberry32(seed);
  if (!team.coachSubmission) return defaultDefenseCall(team, ctx, rng);
  const source = await loadSubmissionSource(team.coachSubmission.id, team.coachSubmission.filePath);
  if (!source) return defaultDefenseCall(team, ctx, rng);

  try {
    const raw = await executeCoachSubmission(
      source,
      {
        mode: "GAMEPLAY_DEFENSE",
        game: ctx,
        allowedCoverages: DefenseCallSchema.shape.coverage.options,
      },
      seed
    );
    const candidate =
      (raw as { defenseCall?: unknown })?.defenseCall ??
      (raw as { call?: unknown })?.call ??
      raw;
    const parsed = DefenseCallSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  return defaultDefenseCall(team, ctx, rng);
}

function offenseScoreForState(state: RuntimeState, homeTeamId: string): [number, number] {
  return state.offenseTeamId === homeTeamId
    ? [state.scoreHome, state.scoreAway]
    : [state.scoreAway, state.scoreHome];
}

function resolvePlay(input: {
  state: RuntimeState;
  offenseCall: OffenseCall;
  defenseCall: DefenseCall;
  offenseTeam: TeamInfo;
  defenseTeam: TeamInfo;
  homeTeamId: string;
  awayTeamId: string;
  rng: () => number;
}) {
  const state = input.state;
  const { offenseCall, defenseCall, rng } = input;
  const isPassConcept = [
    "SLANTS",
    "MESH",
    "STICK",
    "FLOOD",
    "PA_SHOT",
    "FOUR_VERTS",
    "POST_DIG",
    "RB_SCREEN",
    "BUBBLE",
  ].includes(offenseCall.concept);

  const passBias = isPassConcept ? 0.58 : 0.34;
  const defensePressure = defenseCall.pressure === "BLITZ" ? 0.09 : defenseCall.pressure === "SIM" ? 0.04 : 0;
  const aggressionBoost = offenseCall.aggression * 0.08;
  const distancePenalty = Math.max(0, (state.distance - 5) * 0.015);
  const successProbability = clamp(0.52 + aggressionBoost - defensePressure - distancePenalty, 0.15, 0.82);

  const successful = rng() < successProbability;
  const turnoverProbability = clamp(0.012 + offenseCall.aggression * 0.03 + (defenseCall.pressure === "BLITZ" ? 0.01 : 0), 0.01, 0.08);
  const turnover = rng() < turnoverProbability;
  const baseYards = successful
    ? (isPassConcept ? randomInt(rng, 4, 18) : randomInt(rng, 3, 12))
    : (isPassConcept ? randomInt(rng, -9, 3) : randomInt(rng, -4, 2));
  const explosive = successful && rng() < (offenseCall.aggression * 0.15 + (isPassConcept ? 0.06 : 0.03));
  const yards = clamp(baseYards + (explosive ? randomInt(rng, 8, 25) : 0), -15, 60);
  const newYardLine = clamp(state.yardLine + yards, 1, 100);
  const firstDown = newYardLine >= state.yardLine + state.distance;
  const td = newYardLine >= 100 && !turnover;

  let nextDown = firstDown ? 1 : state.down + 1;
  let nextDistance = firstDown ? 10 : Math.max(1, state.distance - yards);

  const runoff = clamp(
    (offenseCall.tempo === "HURRY" ? randomInt(rng, 10, 20) : randomInt(rng, 22, 40)) + (isPassConcept && !successful ? -6 : 0),
    7,
    40
  );

  let nextQtr = state.qtr;
  let nextTime = state.timeSeconds - runoff;
  if (nextTime <= 0) {
    if (state.qtr < 4) {
      nextQtr = state.qtr + 1;
      nextTime = QUARTER_SECONDS;
    } else {
      nextTime = 0;
    }
  }

  if (td || turnover || nextDown > 4) {
    nextDown = 1;
    nextDistance = 10;
  }

  const resultType = turnover
    ? (rng() < 0.55 ? "INT" : "FUMBLE")
    : td
      ? "TD"
      : firstDown
        ? "FIRST_DOWN"
        : "NORMAL";

  return {
    yards,
    turnover,
    firstDown,
    td,
    explosive,
    resultType,
    nextYardLine: td ? 25 : newYardLine,
    nextDown,
    nextDistance,
    runoff,
    nextQtr,
    nextTime,
  };
}

async function getTeamInfo(teamId: string): Promise<TeamInfo> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      coachAgent: {
        include: {
          submissions: {
            where: { status: "RANKED_APPROVED" },
            include: { artifacts: { orderBy: { createdAt: "desc" }, take: 1 } },
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!team) throw new Error(`Team not found: ${teamId}`);
  const approvedSubmission = team.coachAgent?.submissions?.[0];
  const artifact = approvedSubmission?.artifacts?.[0];
  return {
    id: team.id,
    shortName: team.shortName,
    schemeOffense: team.schemeOffense,
    schemeDefense: team.schemeDefense,
    coachSubmission: approvedSubmission && artifact ? { id: approvedSubmission.id, filePath: artifact.filePath } : undefined,
  };
}

function initialState(game: { homeTeamId: string; awayTeamId: string; scoreHome: number; scoreAway: number }): RuntimeState {
  return {
    qtr: 1,
    timeSeconds: QUARTER_SECONDS,
    down: 1,
    distance: 10,
    yardLine: 25,
    offenseTeamId: game.awayTeamId,
    defenseTeamId: game.homeTeamId,
    driveNumber: 1,
    scoreHome: game.scoreHome,
    scoreAway: game.scoreAway,
  };
}

function stateFromLastPlay(last: { resultJson: string; game: { homeTeamId: string; awayTeamId: string; scoreHome: number; scoreAway: number } }) {
  try {
    const parsed = JSON.parse(last.resultJson) as Partial<RuntimeState>;
    return {
      qtr: parsed.qtr ?? 1,
      timeSeconds: parsed.timeSeconds ?? QUARTER_SECONDS,
      down: parsed.down ?? 1,
      distance: parsed.distance ?? 10,
      yardLine: parsed.yardLine ?? 25,
      offenseTeamId: parsed.offenseTeamId ?? last.game.awayTeamId,
      defenseTeamId: parsed.defenseTeamId ?? last.game.homeTeamId,
      driveNumber: parsed.driveNumber ?? 1,
      scoreHome: parsed.scoreHome ?? last.game.scoreHome,
      scoreAway: parsed.scoreAway ?? last.game.scoreAway,
    } satisfies RuntimeState;
  } catch {
    return initialState(last.game);
  }
}

export async function stepGame(gameId: string, playsToSim = 5) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!game) throw new Error("Game not found");
  if (game.status === "FINAL") return { gameId: game.id, status: game.status, playsAdded: 0 };

  const [lastPlay, existingPlayCount] = await Promise.all([
    prisma.play.findFirst({
      where: { gameId: game.id },
      orderBy: { playNumber: "desc" },
      include: { game: { select: { homeTeamId: true, awayTeamId: true, scoreHome: true, scoreAway: true } } },
    }),
    prisma.play.count({ where: { gameId: game.id } }),
  ]);

  let state = lastPlay ? stateFromLastPlay(lastPlay) : initialState(game);
  const teamMap = new Map<string, TeamInfo>();
  teamMap.set(game.homeTeamId, await getTeamInfo(game.homeTeamId));
  teamMap.set(game.awayTeamId, await getTeamInfo(game.awayTeamId));

  if (game.status === "SCHEDULED") {
    await prisma.game.update({
      where: { id: game.id },
      data: { status: "LIVE", startedAt: game.startedAt ?? new Date(), engineVersion: game.engineVersion || GAME_ENGINE_VERSION },
    });
    await prisma.eventLog.create({
      data: {
        leagueId: game.leagueId,
        type: "GAME_STARTED",
        visibility: "PUBLIC",
        summary: `Game started: ${game.awayTeam.shortName} at ${game.homeTeam.shortName}`,
        entityType: "GAME",
        entityId: game.id,
        gameId: game.id,
      },
    });
  }

  let currentDrive = await prisma.drive.findFirst({
    where: { gameId: game.id, endReason: null },
    orderBy: { driveNumber: "desc" },
  });
  if (!currentDrive) {
    currentDrive = await prisma.drive.create({
      data: {
        leagueId: game.leagueId,
        gameId: game.id,
        driveNumber: state.driveNumber,
        offenseTeamId: state.offenseTeamId,
        defenseTeamId: state.defenseTeamId,
        startQtr: state.qtr,
        startTimeSeconds: state.timeSeconds,
        startYardLine: state.yardLine,
      },
    });
  }

  let playsAdded = 0;
  for (let i = 0; i < playsToSim; i += 1) {
    const playNumber = existingPlayCount + playsAdded + 1;
    if (state.qtr > 4 || (state.qtr === 4 && state.timeSeconds <= 0)) break;

    const rng = mulberry32(hashString(`${game.seed}:${playNumber}:${GAME_ENGINE_VERSION}`));
    const offenseTeam = teamMap.get(state.offenseTeamId)!;
    const defenseTeam = teamMap.get(state.defenseTeamId)!;
    const [offenseScore, defenseScore] = offenseScoreForState(state, game.homeTeamId);
    const ctx: CoachContext = {
      qtr: state.qtr,
      timeSeconds: state.timeSeconds,
      down: state.down,
      distance: state.distance,
      yardLine: state.yardLine,
      offenseScore,
      defenseScore,
      driveNumber: state.driveNumber,
      playNumber,
    };

    const [offenseCall, defenseCall] = await Promise.all([
      chooseOffenseCall(offenseTeam, ctx, hashString(`${game.seed}:off:${playNumber}`)),
      chooseDefenseCall(defenseTeam, ctx, hashString(`${game.seed}:def:${playNumber}`)),
    ]);

    const fourthDown = state.down === 4;
    const fgDistance = (100 - state.yardLine) + 17;
    const likelyPunt = fourthDown && state.yardLine < 58 && state.distance > 1 && offenseCall.aggression < 0.62;
    const likelyFg = fourthDown && state.yardLine >= 58 && fgDistance <= 56;

    let description = "";
    let endDriveReason: "TD" | "FG" | "PUNT" | "INT" | "FUMBLE" | "DOWNS" | null = null;
    let points = 0;
    let driveEnded = false;
    let resultPayload: Record<string, unknown>;

    if (fourthDown && (likelyPunt || likelyFg)) {
      if (likelyPunt) {
        const puntNet = randomInt(rng, 32, 48);
        const newLine = clamp(100 - state.yardLine - puntNet, 12, 60);
        description = `${offenseTeam.shortName} punts ${puntNet} yards.`;
        endDriveReason = "PUNT";
        driveEnded = true;
        state = {
          ...state,
          yardLine: newLine,
          offenseTeamId: state.defenseTeamId,
          defenseTeamId: state.offenseTeamId,
          down: 1,
          distance: 10,
          driveNumber: state.driveNumber + 1,
          timeSeconds: Math.max(0, state.timeSeconds - randomInt(rng, 8, 16)),
        };
      } else {
        const makeProb = clamp(0.92 - Math.max(0, fgDistance - 35) * 0.025, 0.1, 0.95);
        const made = rng() < makeProb;
        if (made) {
          points = 3;
          if (state.offenseTeamId === game.homeTeamId) state.scoreHome += 3;
          else state.scoreAway += 3;
          description = `${offenseTeam.shortName} hits a ${fgDistance}-yard field goal.`;
          endDriveReason = "FG";
        } else {
          description = `${offenseTeam.shortName} misses a ${fgDistance}-yard field goal.`;
          endDriveReason = "DOWNS";
        }
        driveEnded = true;
        state = {
          ...state,
          yardLine: 25,
          offenseTeamId: state.defenseTeamId,
          defenseTeamId: state.offenseTeamId,
          down: 1,
          distance: 10,
          driveNumber: state.driveNumber + 1,
          timeSeconds: Math.max(0, state.timeSeconds - randomInt(rng, 4, 8)),
        };
      }

      resultPayload = {
        type: endDriveReason,
        yards: 0,
        turnover: false,
        firstDown: false,
        td: false,
        fg: endDriveReason === "FG",
        qtr: state.qtr,
        timeSeconds: state.timeSeconds,
        down: state.down,
        distance: state.distance,
        yardLine: state.yardLine,
        offenseTeamId: state.offenseTeamId,
        defenseTeamId: state.defenseTeamId,
        driveNumber: state.driveNumber,
        scoreHome: state.scoreHome,
        scoreAway: state.scoreAway,
      };
    } else {
      const result = resolvePlay({
        state,
        offenseCall,
        defenseCall,
        offenseTeam,
        defenseTeam,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        rng,
      });

      if (result.td) {
        points = 7;
        if (state.offenseTeamId === game.homeTeamId) state.scoreHome += 7;
        else state.scoreAway += 7;
        endDriveReason = "TD";
        driveEnded = true;
        description = `${offenseTeam.shortName} ${offenseCall.concept} for ${result.yards} yards - TOUCHDOWN.`;
      } else if (result.turnover) {
        endDriveReason = result.resultType === "INT" ? "INT" : "FUMBLE";
        driveEnded = true;
        description = `${offenseTeam.shortName} ${offenseCall.concept} for ${result.yards} yards - ${result.resultType}.`;
      } else if (result.nextDown > 4) {
        endDriveReason = "DOWNS";
        driveEnded = true;
        description = `${offenseTeam.shortName} ${offenseCall.concept} for ${result.yards} yards - turnover on downs.`;
      } else {
        description = `${offenseTeam.shortName} ${offenseCall.concept} for ${result.yards} yards.`;
      }

      if (driveEnded) {
        state = {
          ...state,
          qtr: result.nextQtr,
          timeSeconds: result.nextTime,
          down: 1,
          distance: 10,
          yardLine: result.turnover ? clamp(100 - result.nextYardLine, 10, 90) : 25,
          offenseTeamId: state.defenseTeamId,
          defenseTeamId: state.offenseTeamId,
          driveNumber: state.driveNumber + 1,
        };
      } else {
        state = {
          ...state,
          qtr: result.nextQtr,
          timeSeconds: result.nextTime,
          down: result.nextDown,
          distance: result.nextDistance,
          yardLine: result.nextYardLine,
        };
      }

      resultPayload = {
        type: result.resultType,
        yards: result.yards,
        turnover: result.turnover,
        firstDown: result.firstDown,
        td: result.td,
        fg: false,
        qtr: state.qtr,
        timeSeconds: state.timeSeconds,
        down: state.down,
        distance: state.distance,
        yardLine: state.yardLine,
        offenseTeamId: state.offenseTeamId,
        defenseTeamId: state.defenseTeamId,
        driveNumber: state.driveNumber,
        scoreHome: state.scoreHome,
        scoreAway: state.scoreAway,
      };
    }

    const play = await prisma.play.create({
      data: {
        leagueId: game.leagueId,
        gameId: game.id,
        driveId: currentDrive.id,
        playNumber,
        qtr: ctx.qtr,
        timeSeconds: ctx.timeSeconds,
        down: ctx.down,
        distance: ctx.distance,
        yardLine: ctx.yardLine,
        offenseTeamId: currentDrive.offenseTeamId,
        defenseTeamId: currentDrive.defenseTeamId,
        offenseCallJson: JSON.stringify(offenseCall),
        defenseCallJson: JSON.stringify(defenseCall),
        resultJson: JSON.stringify(resultPayload),
        description,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: game.leagueId,
        type: "PLAY_ADDED",
        visibility: "PUBLIC",
        summary: `${game.awayTeam.shortName} @ ${game.homeTeam.shortName}: ${description}`,
        entityType: "GAME",
        entityId: game.id,
        gameId: game.id,
        driveId: currentDrive.id,
        playId: play.id,
      },
    });

    playsAdded += 1;

    if (driveEnded && endDriveReason) {
      await prisma.drive.update({
        where: { id: currentDrive.id },
        data: { endReason: endDriveReason, points },
      });

      await prisma.eventLog.create({
        data: {
          leagueId: game.leagueId,
          type: "DRIVE_ENDED",
          visibility: "PUBLIC",
          summary: `Drive ${currentDrive.driveNumber} ended (${endDriveReason})`,
          entityType: "GAME",
          entityId: game.id,
          gameId: game.id,
          driveId: currentDrive.id,
        },
      });

      currentDrive = await prisma.drive.create({
        data: {
          leagueId: game.leagueId,
          gameId: game.id,
          driveNumber: state.driveNumber,
          offenseTeamId: state.offenseTeamId,
          defenseTeamId: state.defenseTeamId,
          startQtr: state.qtr,
          startTimeSeconds: state.timeSeconds,
          startYardLine: state.yardLine,
        },
      });
    }

    if (state.qtr >= 4 && state.timeSeconds <= 0) {
      const winnerTeamId =
        state.scoreHome === state.scoreAway
          ? null
          : state.scoreHome > state.scoreAway
            ? game.homeTeamId
            : game.awayTeamId;

      const finishedAt = new Date();
      const startedAt = game.startedAt ?? finishedAt;
      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: "FINAL",
          scoreHome: state.scoreHome,
          scoreAway: state.scoreAway,
          winnerTeamId,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          engineVersion: GAME_ENGINE_VERSION,
        },
      });

      await prisma.eventLog.create({
        data: {
          leagueId: game.leagueId,
          type: "GAME_FINAL",
          visibility: "PUBLIC",
          summary: `${game.awayTeam.shortName} ${state.scoreAway} - ${game.homeTeam.shortName} ${state.scoreHome} FINAL`,
          entityType: "GAME",
          entityId: game.id,
          gameId: game.id,
        },
      });

      return { gameId: game.id, status: "FINAL", playsAdded };
    }
  }

  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: "LIVE",
      scoreHome: state.scoreHome,
      scoreAway: state.scoreAway,
      engineVersion: GAME_ENGINE_VERSION,
    },
  });

  return {
    gameId: game.id,
    status: "LIVE",
    playsAdded,
    qtr: state.qtr,
    timeSeconds: state.timeSeconds,
    scoreHome: state.scoreHome,
    scoreAway: state.scoreAway,
  };
}
