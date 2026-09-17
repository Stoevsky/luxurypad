import Link from "next/link";
import { Container } from "@/components/ui";
import { ConnectWallet, UnsupportedNetworkNotice } from "@/components/connect-wallet";
import { SearchTrigger } from "@/components/search";
import { Crown } from "@/components/crown";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/launch", label: "Launch" },
  { href: "/markets", label: "Markets" },
  { href: "/themes", label: "Themes" },
  { href: "/portfolio", label: "Portfolio" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur-sm">
      <UnsupportedNetworkNotice />
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Crown className="h-[22px] w-[22px] shrink-0" />
            <span className="display text-[22px] tracking-[-0.03em]">LuxuryPad</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[13px] text-muted transition-colors duration-200 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          <SearchTrigger />
          <ConnectWallet />
        </div>
      </Container>
      <nav className="flex gap-5 overflow-x-auto border-t border-line px-5 py-2.5 md:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap text-[13px] text-muted">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
