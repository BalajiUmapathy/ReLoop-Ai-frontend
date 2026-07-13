import { Component, signal, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';

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
      cards: [
        { icon: '✅', label: 'PLATFORM STATUS', value: 'All systems operational', green: true },
        { icon: '🤖', label: 'ACTIVE AI AGENTS', value: '3 models running' },
        { icon: '📦', label: 'PENDING OPPORTUNITIES', value: '8,920 items', amber: true },
        { icon: '💰', label: "TODAY'S REVENUE", value: '₹39.7L', green: true },
      ],
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

  private responses: Record<string, Message> = {
    'Show top resale opportunities today': {
      role: 'ai', time: '',
      text: 'Based on real-time AI analysis across all UPS hubs, here are today\'s highest-priority resale opportunities. Chennai and Bangalore hubs lead with electronics showing 90%+ demand scores.',
      cards: [
        { icon: '💰', label: 'REVENUE IMPACT', value: '₹35.1L', green: true },
        { icon: '📊', label: 'DEMAND FORECAST', value: '92% avg', amber: true },
        { icon: '📈', label: 'PROFIT POTENTIAL', value: '+₹31.6L', green: true },
        { icon: '⚡', label: 'TOP CATEGORY', value: 'Electronics' },
      ],
    },
    'Show items nearing end of holding period': {
      role: 'ai', time: '',
      text: '4 items are in Day 8+ of their 10-day holding window. Immediate action recommended to avoid central warehouse return costs.',
      cards: [
        { icon: '⚠️', label: 'AT RISK ITEMS', value: '4 items', amber: true },
        { icon: '💸', label: 'COST IF RETURNED', value: '₹1.03L', amber: true },
        { icon: '📍', label: 'TOP HUB AT RISK', value: 'Delhi Hub B' },
        { icon: '⏱️', label: 'AVG HOLD DAY', value: 'Day 9.2' },
      ],
    },
    'Which hub is generating the most savings?': {
      role: 'ai', time: '',
      text: 'Chennai Hub leads all locations this quarter with ₹2.6Cr in recovered revenue and 92% demand score. Bangalore follows closely at ₹2.36Cr.',
      cards: [
        { icon: '🏆', label: 'TOP HUB', value: 'Chennai', green: true },
        { icon: '💰', label: 'REVENUE SAVED', value: '₹2.6Cr', green: true },
        { icon: '📉', label: 'LOGISTICS SAVED', value: '₹40L' },
        { icon: '🌿', label: 'CO₂ REDUCED', value: '12.4T', green: true },
      ],
    },
    'What products should be prioritized for local resale?': {
      role: 'ai', time: '',
      text: 'Electronics — especially wireless earbuds and ANC headphones — have the highest local resale scores. Prioritize Excellent condition items in Chennai and Bangalore hubs.',
      cards: [
        { icon: '🎧', label: 'TOP PRODUCT', value: 'Wireless Earbuds', green: true },
        { icon: '📊', label: 'RESALE SCORE', value: '96%', green: true },
        { icon: '🏪', label: 'BEST HUB', value: 'Chennai Central' },
        { icon: '⚡', label: 'SALE WINDOW', value: '2–3 Days' },
      ],
    },
    'How much transportation cost was saved this month?': {
      role: 'ai', time: '',
      text: 'Local resale diverted 71.6% of returns from central warehouse this month, saving significant logistics costs across all 5 hubs.',
      cards: [
        { icon: '🚚', label: 'TRANSPORT SAVED', value: '₹4.04Cr', green: true },
        { icon: '📦', label: 'ITEMS DIVERTED', value: '8,920', green: true },
        { icon: '🛣️', label: 'MILES SAVED', value: '125K' },
        { icon: '🌿', label: 'CO₂ REDUCED', value: '42.8T', green: true },
      ],
    },
    'Which category gives the highest ROI?': {
      role: 'ai', time: '',
      text: 'Electronics delivers the highest ROI at 89% local resale conversion, followed by Apparel at 76%. Focus AI eligibility scoring on Electronics for maximum impact.',
      cards: [
        { icon: '⚡', label: 'TOP CATEGORY', value: 'Electronics', green: true },
        { icon: '📈', label: 'CONVERSION RATE', value: '89%', green: true },
        { icon: '💰', label: 'AVG REVENUE/ITEM', value: '₹12,000' },
        { icon: '🎯', label: 'DEMAND SCORE', value: '94%', amber: true },
      ],
    },
  };

  private now() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  send(text?: string) {
    const msg = text ?? this.input().trim();
    if (!msg) return;
    const t = this.now();
    this.messages.update(m => [...m, { role: 'user', text: msg, time: t }]);
    this.input.set('');

    // Curated prompts answer instantly for a snappy demo.
    // But also try the live LLM — if it responds, replace the canned answer.
    const canned = this.responses[msg];
    if (canned) {
      const cannedIdx = this.messages().length;
      setTimeout(() => {
        this.messages.update(m => [...m, { ...canned, time: this.now() }]);
      }, 400);

      // Fire-and-forget: upgrade canned response with live LLM if available.
      this.api
        .explainBusiness({ productName: msg })
        .pipe(catchError(() => of(null)))
        .subscribe((res) => {
          if (!res) return;
          const liveCards: Card[] = (res.keyBenefits ?? []).slice(0, 4).map((b) => ({
            icon: '✅', label: 'AI INSIGHT', value: b, green: true,
          }));
          this.messages.update(m => m.map((item, i) =>
            i === cannedIdx
              ? { ...item, text: res.explanation || res.summary || item.text, cards: liveCards.length ? liveCards : item.cards }
              : item,
          ));
        });
      setTimeout(() => {
        this.messages.update(m => [...m, { ...canned, time: this.now() }]);
      }, 500);
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
          this.messages.update(m => [...m, {
            role: 'ai', time: this.now(),
            text: `AI analysis for "${msg}" is being processed. Based on current hub data, all systems are operating optimally with a 71.6% diversion rate.`,
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

  ngAfterViewChecked() {
    this.chatEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }
}
