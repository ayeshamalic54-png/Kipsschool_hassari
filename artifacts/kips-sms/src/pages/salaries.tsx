import { useState } from "react";
import { useListSalaries, useCreateSalary, usePaySalary, useListStaff, getListSalariesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Printer } from "lucide-react";

const schema = z.object({
  staffId: z.string().min(1, "Staff required"),
  amount: z.string().min(1, "Amount required"),
  month: z.string().min(1, "Month required"),
});

export default function Salaries() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: salaries, isLoading } = useListSalaries(statusFilter ? { status: statusFilter as "paid" | "unpaid" } : {});
  const { data: staff } = useListStaff();
  const createMutation = useCreateSalary();
  const payMutation = usePaySalary();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMutation.mutate({ data: { staffId: Number(values.staffId), amount: Number(values.amount), month: values.month } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSalariesQueryKey() });
        toast({ title: "Salary record created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create salary record" }),
    });
  };

  const handlePay = (id: number) => {
    if (!confirm("Mark this salary as paid?")) return;
    payMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSalariesQueryKey() });
        toast({ title: "Salary marked as paid" });
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salaries</h1>
          <p className="text-gray-500 text-sm mt-1">Staff salary management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-salaries"><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white" data-testid="button-add-salary">
                <Plus className="w-4 h-4 mr-2" /> Add Record
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Salary Record</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="staffId" render={({ field }) => (
                    <FormItem><FormLabel>Staff Member *</FormLabel>
                      <Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl>
                        <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" placeholder="35000" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="month" render={({ field }) => (
                    <FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2">
        {[{ val: undefined, label: "All" }, { val: "paid", label: "Paid" }, { val: "unpaid", label: "Unpaid" }].map(f => (
          <Button key={f.label} size="sm" variant={statusFilter === f.val ? "default" : "outline"} onClick={() => setStatusFilter(f.val)} data-testid={`button-filter-${f.label.toLowerCase()}`}>{f.label}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Staff Member", "Month", "Amount (PKR)", "Paid Date", "Status", "Action"].map(h => (
                      <th key={h} className="text-left py-3 px-3 font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!salaries?.length ? (
                    <tr><td colSpan={6} className="py-12 text-center text-gray-400">No salary records found</td></tr>
                  ) : salaries?.map(sal => (
                    <tr key={sal.id} className="border-b hover:bg-gray-50" data-testid={`row-salary-${sal.id}`}>
                      <td className="py-3 px-3 font-medium text-gray-900">{sal.staffName || "—"}</td>
                      <td className="py-3 px-3 text-gray-600">{sal.month}</td>
                      <td className="py-3 px-3 font-bold text-gray-900">PKR {sal.amount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-gray-500">{sal.paidDate || "—"}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sal.status === "paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>{sal.status}</span>
                      </td>
                      <td className="py-3 px-3 print:hidden">
                        {sal.status === "unpaid" && (
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handlePay(sal.id)} disabled={payMutation.isPending} data-testid={`button-pay-salary-${sal.id}`}>Pay</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
