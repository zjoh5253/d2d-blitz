"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqAccordionProps {
  items: { question: string; answer: string }[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const isLast = index === items.length - 1;

        return (
          <div key={index} className={cn(!isLast && "border-b border-slate-200")}>
            <button
              className="flex w-full items-center justify-between py-4 text-left text-base font-medium text-slate-900 hover:text-blue-600 transition-colors"
              onClick={() => handleToggle(index)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
              <ChevronDown
                className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                size={20}
              />
            </button>
            <div
              className="grid transition-all duration-200"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="pb-4 text-slate-600 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
