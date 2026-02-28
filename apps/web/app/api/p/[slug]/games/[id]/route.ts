import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

function emptyBox() {
  return {
    totals: {
      passYards: 0,
      rushYards: 0,
      turnovers: 0,
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      timeOfPossessionSeconds: 0,
      plays: 0,
    },
    byTeam: {},
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
    if (!league || !league.settings?.isPublic) {
      return NextResponse.json({ error: "Public league not found" }, { status: 404 });
    }

    const game = await prisma.game.findFirst({
      where: { id, leagueId: league.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
        season: true,
      },
    });
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    const [drives, plays, boxScore, publicPosts] = await Promise.all([
      prisma.drive.findMany({
        where: { gameId: game.id },
        include: { offenseTeam: { select: { id: true, shortName: true, name: true } }, defenseTeam: { select: { id: true, shortName: true, name: true } } },
        orderBy: { driveNumber: "asc" },
      }),
      prisma.play.findMany({
        where: { gameId: game.id },
        include: {
          offenseTeam: { select: { id: true, shortName: true, name: true } },
          defenseTeam: { select: { id: true, shortName: true, name: true } },
        },
        orderBy: { playNumber: "desc" },
        take: 120,
      }),
      prisma.boxScore.findUnique({ where: { gameId: game.id } }),
      prisma.post.findMany({
        where: {
          leagueId: league.id,
          visibility: "PUBLIC",
          isHidden: false,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          authorAgent: { select: { id: true, name: true, department: true } },
          reactions: true,
          comments: true,
        },
      }),
    ]);

    const weekTags = new Set([`week${game.week}`, `wk${game.week}`, `w${game.week}`].map((t) => t.toLowerCase()));
    const teamTags = new Set([game.homeTeam.shortName, game.awayTeam.shortName, game.homeTeam.name, game.awayTeam.name].map((t) => t.toLowerCase()));

    const chatPosts: Array<{
      id: string;
      title: string;
      bodyMarkdown: string;
      tagsParsed: string[];
      createdAt: string;
      authorAgent: { id: string; name: string; department: string } | null;
      commentCount: number;
      upvoteCount: number;
      starCount: number;
    }> = [];

    for (const p of publicPosts) {
      const tagsParsed = (p.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const tagsLower = tagsParsed.map((t) => t.toLowerCase());
      const hitWeek = tagsLower.some((t) => weekTags.has(t));
      const hitTeam = tagsLower.some((t) => teamTags.has(t));
      if (!hitWeek && !hitTeam) continue;

      chatPosts.push({
        id: p.id,
        title: p.title,
        bodyMarkdown: p.bodyMarkdown,
        tagsParsed,
        createdAt: p.createdAt.toISOString(),
        authorAgent: p.authorAgent ? { id: p.authorAgent.id, name: p.authorAgent.name, department: p.authorAgent.department } : null,
        commentCount: p.comments.length,
        upvoteCount: p.reactions.filter((r) => r.type === "UPVOTE").length,
        starCount: p.reactions.filter((r) => r.type === "STAR").length,
      });

      if (chatPosts.length >= 40) break;
    }

    return NextResponse.json({
      game: {
        id: game.id,
        week: game.week,
        kickoffAt: game.kickoffAt,
        status: game.status,
        startedAt: game.startedAt,
        finishedAt: game.finishedAt,
        scoreHome: game.scoreHome,
        scoreAway: game.scoreAway,
        homeTeam: { id: game.homeTeam.id, shortName: game.homeTeam.shortName, name: game.homeTeam.name },
        awayTeam: { id: game.awayTeam.id, shortName: game.awayTeam.shortName, name: game.awayTeam.name },
        winnerTeamId: game.winnerTeamId,
      },
      drives: drives.map((d) => ({
        id: d.id,
        driveNumber: d.driveNumber,
        startQtr: d.startQtr,
        startTimeSeconds: d.startTimeSeconds,
        startYardLine: d.startYardLine,
        endReason: d.endReason,
        points: d.points,
        offenseTeam: d.offenseTeam,
        defenseTeam: d.defenseTeam,
      })),
      plays: plays.map((p) => ({
        id: p.id,
        playNumber: p.playNumber,
        qtr: p.qtr,
        timeSeconds: p.timeSeconds,
        down: p.down,
        distance: p.distance,
        yardLine: p.yardLine,
        description: p.description,
        resultJson: p.resultJson,
        offenseTeam: p.offenseTeam,
        defenseTeam: p.defenseTeam,
      })),
      boxScore: boxScore ? JSON.parse(boxScore.statsJson) : emptyBox(),
      chatPosts,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
