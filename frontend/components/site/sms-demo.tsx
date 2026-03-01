"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const script = [
  { from: "customer", text: "Hi, my truck won’t start. Need service today." },
  { from: "ai", text: "Thanks for contacting us. What is the truck model and location?" },
  { from: "customer", text: "2019 Freightliner. On-site near I-95 exit 20." },
  { from: "ai", text: "Got it. Earliest slot is 3:30 PM. Reply YES to confirm." },
  { from: "customer", text: "YES" },
  { from: "ai", text: "Confirmed. We sent details to the shop manager and booked your slot." }
];

export function SmsDemo() {
  const [step, setStep] = useState(2);
  const visible = script.slice(0, step);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Try SMS demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border bg-slate-50 p-3">
          {visible.map((line, index) => (
            <div
              key={`${line.text}-${index}`}
              className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
                line.from === "ai"
                  ? "mr-auto bg-white text-slate-900"
                  : "ml-auto bg-primary text-primary-foreground"
              }`}
            >
              {line.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(2)}>
            Reset
          </Button>
          <Button onClick={() => setStep((prev) => Math.min(prev + 1, script.length))}>Next message</Button>
        </div>
      </CardContent>
    </Card>
  );
}
