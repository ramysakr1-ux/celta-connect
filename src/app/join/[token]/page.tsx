import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "@/app/join/[token]/join-form";
import type { UserRole } from "@/lib/supabase/types";

const glossyFrame = {
  background:
    "radial-gradient(circle at 8% 15%, #454545 0%, transparent 50%)," +
    "radial-gradient(circle at 92% 15%, #454545 0%, transparent 50%)," +
    "radial-gradient(circle at 50% 100%, #262626 0%, transparent 60%)," +
    "#000000",
};

// The two side "lines" use a repeating gradient whose position animates,
// so the bright segment reads as one continuous pulse of light traveling
// down an unbroken wire rather than separate blinking dashes.
function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden p-8"
      style={glossyFrame}
    >
      <style>{`
        @keyframes connect-line-flow {
          from { background-position: 0 0; }
          to { background-position: 0 160px; }
        }
        .connect-line {
          background-image: repeating-linear-gradient(
            to bottom,
            #030303 0px,
            #030303 10px,
            #1a1a1a 40px,
            #3d3d3d 60px,
            #5c5c5c 76px,
            #3d3d3d 92px,
            #1a1a1a 112px,
            #030303 140px,
            #030303 160px
          );
          background-size: 100% 160px;
          animation: connect-line-flow 4s linear infinite;
          filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.2));
          opacity: 0.85;
        }
      `}</style>
      <div className="connect-line absolute inset-y-0 left-10 w-[2px]" />
      <div className="connect-line absolute inset-y-0 right-10 w-[2px]" />
      {children}
    </div>
  );
}

function Wordmark() {
  return (
    <h1 className="font-serif text-2xl text-[#c99a4a]">
      <span>CELTA</span> <span className="text-lg italic">Connect</span>
    </h1>
  );
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, name, trainee_join_token, trainer_join_token")
    .or(`trainee_join_token.eq.${token},trainer_join_token.eq.${token}`)
    .maybeSingle();

  if (!course) {
    return (
      <PageFrame>
        <div className="w-full max-w-sm rounded-lg border border-[#262626] bg-[#111111] p-8">
          <Wordmark />
          <p className="mt-4 text-sm text-[#e5a3a3]">
            This join link is invalid or has expired. Ask your center admin for a new one.
          </p>
        </div>
      </PageFrame>
    );
  }

  const role: UserRole = course.trainee_join_token === token ? "trainee" : "trainer";

  return (
    <PageFrame>
      <div className="w-full max-w-sm rounded-lg border border-[#262626] bg-[#111111] p-8">
        <Wordmark />
        <p className="mt-1 text-[#f5f5f0]">
          You&apos;re joining {course.name} as a <span className="capitalize">{role}</span>.
        </p>
        <JoinForm token={token} />
      </div>
    </PageFrame>
  );
}
