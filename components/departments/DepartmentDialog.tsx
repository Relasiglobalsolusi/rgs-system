"use client";

import { useState, useTransition } from "react";
import { createDepartment } from "@/app/departments/actions";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Building2, Plus } from "lucide-react";

export default function DepartmentDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await createDepartment(formData);
        setOpen(false);
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : "Failed to create department.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cyan-500 text-white hover:bg-cyan-600">
          <Plus className="mr-2 h-4 w-4" />
          Add Department
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl border-white/10 bg-[#151b22] text-white">
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
            <Building2 className="h-6 w-6 text-cyan-400" />
          </div>

          <DialogTitle className="text-xl">
            Create Department
          </DialogTitle>

          <DialogDescription>
            Add a new department to your organization.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Department Name
            </label>

            <Input
              name="name"
              placeholder="Sales"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Department Code
            </label>

            <Input
              name="code"
              placeholder="SAL"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description
            </label>

            <Textarea
              name="description"
              rows={4}
              placeholder="Department description..."
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-cyan-500 hover:bg-cyan-600"
            >
              {pending ? "Creating..." : "Create Department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}