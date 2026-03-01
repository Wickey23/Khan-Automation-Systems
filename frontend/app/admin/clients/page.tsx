"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAdminClients } from "@/lib/api";
import type { Client } from "@/lib/types";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    void fetchAdminClients().then((data) => setClients(data.clients)).catch(() => setClients([]));
  }, []);

  return (
    <AdminGuard>
      <div className="container py-10">
        <h1 className="text-3xl font-bold">Admin Clients</h1>
        <div className="mt-6 grid gap-4">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="font-semibold">{client.name}</p>
                  <p className="text-sm text-muted-foreground">Status: {client.status}</p>
                </div>
                <Link href={`/admin/clients/${client.id}`} className="text-sm font-medium text-primary">
                  Manage
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminGuard>
  );
}
