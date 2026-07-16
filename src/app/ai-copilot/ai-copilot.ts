import { Component, signal, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiService, DashboardMetrics, DebugMatch, DebugInventory } from '../core/api.service';

interface Card { icon: string; label: string; value: string; green?: boolean; amber?: boolean; }
interface Message {
  role: 'ai' | 'user';
  text?: string;
  time: string;
  cards?: Card[];
}

@Component({
  selector: 'app-ai-copilot',
  imports: [FormsModule],
  templateUrl: './ai-copilot.html',
  styleUrl: './ai-copilot.css',
})
export class AiCopilotComponent implements AfterViewChecked {
  @ViewChild('chatEnd') chatEnd!: ElementRef;
  private api = inject(ApiService);
  thinking = signal(false);

  input = signal('');
  messages = signal<Message[]>([
    {
      role: 'ai', time: '09:00 AM',
      text: 'Welcome to ReLoop AI Copilot — grounded in live return, match and savings data. '
        + 'Ask about resale opportunities, hub savings, holding-period risk, or category ROI.',
      cards: [],
    },
  ]);

  prompts = [
    'Show top resale opportunities today',
    'Show items nearing end of holding period',
    'Which hub is generating the most savings?',
    'What products should be prioritized for local resale?',
    'How much transportation cost was saved this month?',
    'Which category gives the highest ROI?',
  ];

  // Live data backing every copilot answer.
  private metrics = signal<DashboardMetrics | null>(null);
  private matches = signal<DebugMatch[]>([]);
  private inventory = signal<DebugInventory[]>([]);

  constructor() {
    this.api.getDashboardMetrics().pipe(catchError(() => of(null))).subscribe((m) => {
      this.metrics.set(m);
      this.refreshIntro();
    });
    this.api.getMatches().pipe(catchError(() => of(null))).subscribe((r) => {
      this.matches.set(r?.data ?? []);
      this.refreshIntro();
    });
    this.api.getInventory().pipe(catchError(() => of(null))).subscribe((r) => {
      this.inventory.set(r?.data ?? []);
    });
  }

  /** Fill the welcome card row from live metrics once they arrive. */
  private refreshIntro() {
    const m = this.metrics();
    if (!m) return;
    const pending = Math.max(0, m.totalReturns - m.localMatches);
    const cards: Card[] = [
      { icon: '✅', label: 'PLATFORM STATUS', value: 'All systems operational', green: true },
      { icon: '📦', label: 'PENDING OPPORTUNITIES', value: `${pending.toLocaleString('en-IN')} items`, amber: true },
      { icon: '💰', label: 'COST SAVED TO DATE', value: this.money(m.costSaved), green: true },
      { icon: '♻️', label: 'DIVERSION RATE', value: `${Math.round(m.diversionRate)}%`, green: true },
    ];
    this.messages.update((list) => {
      const copy = [...list];
      copy[0] = { ...copy[0], cards };
      return copy;
    });
  }

  private now() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  send(text?: string) {
    const msg = text ?? this.input().trim();
    if (!msg) return;
    const t = this.now();
    this.messages.update(m => [...m, { role: 'user', text: msg, time: t }]);
    this.input.set('');

    // Suggested prompts are answered from live return / match / inventory data.
    if (this.prompts.includes(msg)) {
      setTimeout(() => {
        this.messages.update(m => [...m, this.buildAnswer(msg)]);
      }, 400);
      return;
    }

    // Free-text goes to the real LLM (POST /api/businessexplanation).
    this.thinking.set(true);
    this.api
      .explainBusiness({ productName: msg })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.thinking.set(false);
        if (!res) {
          const m = this.metrics();
          this.messages.update(list => [...list, {
            role: 'ai', time: this.now(),
            text: m
              ? `Live figures: ${Math.round(m.diversionRate)}% diversion rate, `
                + `${m.localMatches.toLocaleString('en-IN')} local matches, ${this.money(m.costSaved)} saved. `
                + `Ask a suggested prompt for a detailed breakdown.`
              : `I need a live backend connection to answer "${msg}" with grounded figures. `
                + `Start the API to see real numbers.`,
          }]);
          return;
        }
        const cards: Card[] = (res.keyBenefits ?? []).slice(0, 4).map((b) => ({
          icon: '✅', label: 'AI INSIGHT', value: b, green: true,
        }));
        this.messages.update(m => [...m, {
          role: 'ai', time: this.now(),
          text: res.explanation || res.summary,
          cards: cards.length ? cards : undefined,
        }]);
      });
  }

  /** Builds a grounded answer for a suggested prompt from live data. */
  private buildAnswer(prompt: string): Message {
    const rows = this.matches();
    const m = this.metrics();
    const inv = this.inventory();
    const offline: Message = {
      role: 'ai', time: this.now(),
      text: `I need a live backend connection to answer "${prompt}" with real figures. Start the API to see grounded numbers.`,
    };

    switch (prompt) {
      case 'Show top resale opportunities today': {
        if (!rows.length) return offline;
        const avg = Math.round(rows.reduce((s, r) => s + r.matchScore, 0) / rows.length);
        const totalCost = rows.reduce((s, r) => s + r.costSaved, 0);
        const cat = this.categoryRoi()[0];
        return {
          role: 'ai', time: this.now(),
          text: `${rows.length} live matches are scored for local resale with an average match score of ${avg}.`
            + (cat ? ` ${cat.cat} leads on demand.` : ''),
          cards: [
            { icon: '💰', label: 'LOGISTICS SAVED', value: this.money(totalCost), green: true },
            { icon: '📊', label: 'AVG MATCH SCORE', value: `${avg}%`, amber: true },
            { icon: '⚡', label: 'TOP CATEGORY', value: cat?.cat ?? '—' },
            { icon: '📦', label: 'LOCAL MATCHES', value: (m?.localMatches ?? rows.length).toLocaleString('en-IN') },
          ],
        };
      }
      case 'Show items nearing end of holding period': {
        if (!inv.length) return offline;
        const atRisk = inv.filter(i => i.holdingDays >= 8);
        const topHub = this.topCity(atRisk.map(i => i.location));
        const avgDay = atRisk.length
          ? (atRisk.reduce((s, i) => s + i.holdingDays, 0) / atRisk.length).toFixed(1)
          : '—';
        return {
          role: 'ai', time: this.now(),
          text: `${atRisk.length} item(s) are in day 8+ of the 10-day holding window. `
            + `Acting now avoids central-warehouse return costs.`,
          cards: [
            { icon: '⚠️', label: 'AT RISK ITEMS', value: `${atRisk.length} items`, amber: true },
            { icon: '📍', label: 'TOP HUB AT RISK', value: topHub ?? '—' },
            { icon: '⏱️', label: 'AVG HOLD DAY', value: `Day ${avgDay}` },
            { icon: '📦', label: 'TOTAL IN HOLDING', value: inv.length.toLocaleString('en-IN') },
          ],
        };
      }
      case 'Which hub is generating the most savings?': {
        const hubs = this.hubSavings();
        if (!hubs.length) return offline;
        const top = hubs[0];
        return {
          role: 'ai', time: this.now(),
          text: `${top.city} leads with ${this.money(top.cost)} in logistics cost saved across `
            + `${top.n} matches (avg score ${Math.round(top.avg)}).`,
          cards: [
            { icon: '🏆', label: 'TOP HUB', value: top.city, green: true },
            { icon: '💰', label: 'COST SAVED', value: this.money(top.cost), green: true },
            { icon: '🌿', label: 'CO₂ REDUCED', value: `${top.co2.toFixed(1)} kg`, green: true },
            { icon: '📦', label: 'MATCHES', value: `${top.n}` },
          ],
        };
      }
      case 'What products should be prioritized for local resale?': {
        if (!rows.length) return offline;
        const top = [...rows].sort((a, b) => b.matchScore - a.matchScore).slice(0, 1)[0];
        return {
          role: 'ai', time: this.now(),
          text: `${top.productName || top.productId} scores highest for local resale at `
            + `${Math.round(top.matchScore)}% in ${this.city(top.location)}. `
            + `Prioritise excellent-condition items in the top-scoring hubs.`,
          cards: [
            { icon: '🎯', label: 'TOP PRODUCT', value: this.short(top.productName || top.productId, 18), green: true },
            { icon: '📊', label: 'MATCH SCORE', value: `${Math.round(top.matchScore)}%`, green: true },
            { icon: '🏪', label: 'BEST HUB', value: this.city(top.location) },
            { icon: '🏷️', label: 'CATEGORY', value: `${top.category || 'General'}` },
          ],
        };
      }
      case 'How much transportation cost was saved this month?': {
        if (!m) return offline;
        return {
          role: 'ai', time: this.now(),
          text: `Local resale achieved a ${Math.round(m.diversionRate)}% diversion rate, `
            + `saving ${this.money(m.costSaved)} in logistics and avoiding `
            + `${Math.round(m.distanceSavedKm).toLocaleString('en-IN')} km of transport.`,
          cards: [
            { icon: '🚚', label: 'TRANSPORT SAVED', value: this.money(m.costSaved), green: true },
            { icon: '📦', label: 'ITEMS DIVERTED', value: m.localMatches.toLocaleString('en-IN'), green: true },
            { icon: '🛣️', label: 'DISTANCE SAVED', value: `${Math.round(m.distanceSavedKm).toLocaleString('en-IN')} km` },
            { icon: '🌿', label: 'CO₂ REDUCED', value: `${Math.round(m.co2SavedKg).toLocaleString('en-IN')} kg`, green: true },
          ],
        };
      }
      case 'Which category gives the highest ROI?': {
        const cats = this.categoryRoi();
        if (!cats.length) return offline;
        const top = cats[0];
        const second = cats[1];
        return {
          role: 'ai', time: this.now(),
          text: `${top.cat} delivers the highest average match score at ${Math.round(top.avg)}%`
            + (second ? `, followed by ${second.cat} at ${Math.round(second.avg)}%.` : '.'),
          cards: [
            { icon: '⚡', label: 'TOP CATEGORY', value: top.cat, green: true },
            { icon: '📈', label: 'AVG MATCH SCORE', value: `${Math.round(top.avg)}%`, green: true },
            { icon: '📦', label: 'MATCHES', value: `${top.n}` },
            { icon: '🥈', label: 'RUNNER-UP', value: second?.cat ?? '—', amber: true },
          ],
        };
      }
      default:
        return offline;
    }
  }

  private short(s: string, n: number): string {
    return !s ? '' : s.length > n ? s.slice(0, n) + '…' : s;
  }

  private city(loc: string): string {
    return (loc || 'Unknown').split(/[ ,]/)[0];
  }

  private topCity(locations: string[]): string | null {
    const counts = new Map<string, number>();
    for (const l of locations) {
      const c = this.city(l);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  private hubSavings() {
    const agg = new Map<string, { cost: number; co2: number; n: number; score: number }>();
    for (const m of this.matches()) {
      const c = this.city(m.location);
      const a = agg.get(c) ?? { cost: 0, co2: 0, n: 0, score: 0 };
      a.cost += m.costSaved; a.co2 += m.co2Saved; a.n += 1; a.score += m.matchScore;
      agg.set(c, a);
    }
    return [...agg.entries()]
      .map(([city, a]) => ({ city, cost: a.cost, co2: a.co2, n: a.n, avg: a.score / a.n }))
      .sort((x, y) => y.cost - x.cost);
  }

  private categoryRoi() {
    const agg = new Map<string, { n: number; score: number }>();
    for (const m of this.matches()) {
      const c = m.category || 'General';
      const a = agg.get(c) ?? { n: 0, score: 0 };
      a.n += 1; a.score += m.matchScore; agg.set(c, a);
    }
    return [...agg.entries()]
      .map(([cat, a]) => ({ cat, n: a.n, avg: a.score / a.n }))
      .sort((x, y) => y.avg - x.avg);
  }

  private money(v: number): string {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${Math.round(v).toLocaleString('en-US')}`;
  }

  ngAfterViewChecked() {
    this.chatEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }
}
