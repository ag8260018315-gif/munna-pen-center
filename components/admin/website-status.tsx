import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { WebsiteStatus } from "@/lib/admin/catalogue-admin";

/**
 * Says plainly what visitors see: the products saved in the admin, or the small built-in starter list. A server component on
 * purpose — it names a hosting setting, and that name must never reach the browser bundle.
 *
 * `attention` (the dashboard) shows only when something needs doing; `full` (the Products page) always shows the state.
 */
type Tone = "warning" | "success" | "info";
interface Message {
  tone: Tone;
  title: string;
  body: ReactNode;
  steps?: ReactNode[];
}

const code = (text: string) => <code className="rounded bg-white/70 px-1 font-mono text-[0.92em]">{text}</code>;

const FIX_STEPS = (): ReactNode[] => [
  <>In Vercel open <strong>Settings → Environment Variables</strong> and add {code("CATALOGUE_SOURCE")} with the value {code("database")}, ticking <strong>Production</strong>.</>,
  <>Open <strong>Deployments</strong>, take the newest Production one, press <strong>⋯ → Redeploy</strong>. A new setting only works after a redeploy.</>,
  <>Wait a minute, then refresh your website&apos;s Products page (Ctrl+Shift+R).</>,
];

export function describeWebsiteStatus(status: WebsiteStatus): Message[] {
  const out: Message[] = [];
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

  if (status.source === "invalid") {
    out.push({
      tone: "warning",
      title: "The website setting has a value it does not understand",
      body: <>The setting {code("CATALOGUE_SOURCE")} exists, but its value is not exactly {code("database")} (lowercase, no extra words). Correct it in Vercel and redeploy.</>,
      steps: FIX_STEPS(),
    });
  } else if (status.source === "built-in") {
    if (status.visibleProducts > 0 || status.similarNames.length > 0) {
      out.push({
        tone: "warning",
        title: "Your website is not showing these products yet",
        body: (
          <>
            The website is still showing its small built-in starter list. {status.visibleProducts > 0 ? `${n(status.visibleProducts, "Active product", "Active products")} saved here cannot be seen by visitors.` : ""}
            {status.similarNames.length > 0 && (
              <>
                {" "}
                I found a setting called {status.similarNames.map((name, i) => (
                  <span key={name}>{i > 0 && ", "}{code(name)}</span>
                ))}, but the website ignores it: the name must be exactly {code("CATALOGUE_SOURCE")}.
              </>
            )}
          </>
        ),
        steps: FIX_STEPS(),
      });
    } else {
      out.push({
        tone: "info",
        title: "The website shows its built-in starter list",
        body: <>Once you have Active products here, add the setting {code("CATALOGUE_SOURCE")} = {code("database")} in Vercel and redeploy, so visitors see them.</>,
      });
    }
  } else if (status.visibleProducts === 0) {
    out.push({
      tone: "warning",
      title: "Visitors see an empty catalogue",
      body: <>The website reads the products saved here, but none is both <strong>Active</strong> and in an <strong>active category</strong>. Publish products, or remove the {code("CATALOGUE_SOURCE")} setting and redeploy to go back to the built-in list.</>,
    });
  } else {
    out.push({
      tone: "success",
      title: "Your website is showing the products saved here",
      body: <>{n(status.visibleProducts, "product is", "products are")} visible to visitors. Changes appear within a few minutes.</>,
    });
  }

  if (status.source === "database" && status.hiddenByCategory > 0) {
    out.push({
      tone: "warning",
      title: `${n(status.hiddenByCategory, "Active product is", "Active products are")} hidden`,
      body: <>Their category is switched off, so visitors cannot see them. Switch the category on under <strong>Categories</strong>.</>,
    });
  }
  return out;
}

const TONE: Record<Tone, { box: string; icon: typeof Info }> = {
  warning: { box: "border-amber-300 bg-amber-50 text-amber-950", icon: AlertTriangle },
  success: { box: "border-emerald-300 bg-emerald-50 text-emerald-950", icon: CheckCircle2 },
  info: { box: "border-sky-300 bg-sky-50 text-sky-950", icon: Info },
};

export function WebsiteStatusBanner({ status, variant, idPrefix = "site-status" }: { status: WebsiteStatus; variant: "full" | "attention"; idPrefix?: string }) {
  const messages = describeWebsiteStatus(status).filter((m) => variant === "full" || m.tone === "warning");
  if (messages.length === 0) return null;
  return (
    <div className="grid gap-3">
      {messages.map((message, index) => {
        const { box, icon: Icon } = TONE[message.tone];
        const id = `${idPrefix}-${index}`;
        return (
          <section key={id} aria-labelledby={id} className={cn("rounded-xl border p-4", box)}>
            <h2 id={id} className="flex items-start gap-2 text-base font-extrabold">
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              {message.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{message.body}</p>
            {message.steps && (
              <ol className="mt-3 grid list-decimal gap-1.5 pl-6 text-sm leading-relaxed">
                {message.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
