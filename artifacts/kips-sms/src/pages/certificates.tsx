import { useState } from "react";
import { useListCertificates, useCreateCertificate, useListStudents, getListCertificatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Award, Printer } from "lucide-react";

const certTypes = {
  leaving: { label: "School Leaving Certificate", color: "from-blue-500 to-cyan-500" },
  birth: { label: "Birth Certificate", color: "from-purple-500 to-indigo-500" },
  bonafide: { label: "Bonafide Certificate", color: "from-emerald-500 to-green-500" },
  character: { label: "Character Certificate", color: "from-amber-500 to-orange-500" },
  result: { label: "Result Card", color: "from-violet-500 to-fuchsia-500" },
  fee_clearance: { label: "Fee Clearance Certificate", color: "from-teal-500 to-emerald-600" },
};

const schema = z.object({
  studentId: z.string().min(1, "Student required"),
  type: z.enum(["leaving", "birth", "bonafide", "character", "result", "fee_clearance"]),
  issuedDate: z.string().min(1, "Date required"),
  remarks: z.string().optional(),
});

export default function Certificates() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: certificates, isLoading } = useListCertificates({});
  const { data: students } = useListStudents({});
  const createMutation = useCreateCertificate();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { type: "leaving", issuedDate: new Date().toISOString().split("T")[0] },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMutation.mutate({ data: { ...values, studentId: Number(values.studentId) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
        toast({ title: "Certificate generated successfully" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to generate certificate" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
          <p className="text-gray-500 text-sm mt-1">Generate and manage student certificates</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white" data-testid="button-generate-certificate">
              <Plus className="w-4 h-4 mr-2" /> Generate Certificate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Certificate</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="studentId" render={({ field }) => (
                  <FormItem><FormLabel>Student *</FormLabel>
                    <Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                      <SelectContent>{students?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.admissionNumber})</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Certificate Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(certTypes).map(([val, ct]) => <SelectItem key={val} value={val}>{ct.label}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="issuedDate" render={({ field }) => (
                  <FormItem><FormLabel>Issued Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="remarks" render={({ field }) => (
                  <FormItem><FormLabel>Remarks</FormLabel><FormControl><Input placeholder="Optional remarks..." {...field} /></FormControl></FormItem>
                )} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Generate
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-36" />)}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!certificates?.length ? (
            <div className="col-span-full text-center py-16 text-gray-500">No certificates generated yet</div>
          ) : certificates?.map(cert => {
            const ct = certTypes[cert.type as keyof typeof certTypes] || certTypes.leaving;
            return (
              <Card key={cert.id} className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`card-cert-${cert.id}`}>
                <div className={`h-1.5 bg-gradient-to-r ${ct.color}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ct.color} flex items-center justify-center shadow-sm`}>
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.print()} data-testid={`button-print-cert-${cert.id}`}>
                      <Printer className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{ct.label}</h3>
                  <p className="text-gray-600 text-sm mt-1">{cert.studentName || "—"}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span className="font-mono">{cert.certificateNumber}</span>
                    <span>{cert.issuedDate}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
