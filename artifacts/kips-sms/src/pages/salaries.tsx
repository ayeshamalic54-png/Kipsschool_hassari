import { useState, useRef } from "react";
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
import { Plus, Loader2, Printer, FileText, X } from "lucide-react";

const schema = z.object({
  staffId: z.string().min(1, "Staff required"),
  amount: z.string().min(1, "Amount required"),
  month: z.string().min(1, "Month required"),
});

const deductionSchema = z.object({
  absentDays: z.string().default("0"),
  lateDays: z.string().default("0"),
  tax: z.string().default("0"),
  otherDeduction: z.string().default("0"),
  otherDeductionLabel: z.string().default(""),
  allowance: z.string().default("0"),
  allowanceLabel: z.string().default(""),
});

type Salary = {
  id: number;
  staffId?: number;
  staffName?: string | null;
  month: string;
  amount: number;
  status: string;
  paidDate?: string | null;
};

function SalarySlip({ salary, onClose }: { salary: Salary; onClose: () => void }) {
  const slipRef = useRef<HTMLDivElement>(null);
  const form = useForm<z.infer<typeof deductionSchema>>({
    resolver: zodResolver(deductionSchema),
    defaultValues: { absentDays: "0", lateDays: "0", tax: "0", otherDeduction: "0", otherDeductionLabel: "", allowance: "0", allowanceLabel: "" },
  });

  const values = form.watch();
  const basicSalary = salary.amount;
  const perDay = Math.round(basicSalary / 26);
  const absentDed = Number(values.absentDays || 0) * perDay;
  const lateDed = Number(values.lateDays || 0) * Math.round(perDay / 2);
  const taxDed = Number(values.tax || 0);
  const otherDed = Number(values.otherDeduction || 0);
  const allowance = Number(values.allowance || 0);
  const totalDeductions = absentDed + lateDed + taxDed + otherDed;
  const netSalary = basicSalary + allowance - totalDeductions;

  const monthLabel = salary.month
    ? new Date(salary.month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" })
    : salary.month;

  const handlePrint = () => {
    const content = slipRef.current?.innerHTML;
    const w = window.open("", "_blank");
    if (!w || !content) return;
    w.document.write(`<html><head><title>Salary Slip</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#111}
        table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
        td,th{padding:6px 10px;border:1px solid #ddd}
        th{background:#f0f4ff;font-weight:600;text-align:left}
        .net-row td{font-weight:bold;font-size:15px;background:#1a2a5e;color:white}
        .footer{margin-top:50px;display:flex;justify-content:space-between}
        .sig{border-top:1px solid #333;width:150px;text-align:center;padding-top:4px;font-size:12px}
      </style></head><body>${content}
      <div class="footer">
        <div class="sig">Employee Signature</div>
        <div class="sig">Principal Signature</div>
      </div></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Salary Slip — {salary.staffName}
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b pb-2">Enter Deductions & Allowances</h3>
            <Form {...form}>
              <form className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="absentDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Absent Days</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lateDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Late Days (½ day)</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="tax" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tax / Income Tax (PKR)</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="otherDeductionLabel" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Other Deduction</FormLabel>
                      <FormControl><Input placeholder="e.g. Loan" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="otherDeduction" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Amount (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <FormField control={form.control} name="allowanceLabel" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-emerald-600">+ Allowance Label</FormLabel>
                      <FormControl><Input placeholder="e.g. Transport" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="allowance" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-emerald-600">Amount (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </form>
            </Form>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
              <div>Per day rate: PKR {perDay.toLocaleString()}</div>
              <div className="text-red-600">Total Deductions: PKR {totalDeductions.toLocaleString()}</div>
              <div className="text-emerald-600 font-bold text-sm">Net Salary: PKR {netSalary.toLocaleString()}</div>
            </div>
          </div>

          <div className="border rounded-xl p-4 bg-gray-50 overflow-auto" ref={slipRef}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #1a2a5e", paddingBottom: "10px", marginBottom: "10px" }}>
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "#1a2a5e" }}>KIPS School Hassari</div>
              <div style={{ fontSize: "11px", color: "#666" }}>Bright Future — School Portal</div>
            </div>
            <div style={{ textAlign: "center", background: "#1a2a5e", color: "white", padding: "4px 8px", borderRadius: "4px", marginBottom: "10px", fontSize: "12px", fontWeight: "bold" }}>
              SALARY SLIP — {monthLabel}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "8px" }}>
              <tbody>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Employee</td><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>{salary.staffName}</td></tr>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Month</td><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>{monthLabel}</td></tr>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Working Days</td><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>26</td></tr>
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ background: "#f0f4ff" }}>
                  <th style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "left" }}>Description</th>
                  <th style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "right" }}>PKR</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>Basic Salary</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right" }}>{basicSalary.toLocaleString()}</td></tr>
                {allowance > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#16a34a" }}>+ {values.allowanceLabel || "Allowance"}</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#16a34a" }}>+{allowance.toLocaleString()}</td></tr>}
                {absentDed > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- Absent ({values.absentDays}d × {perDay.toLocaleString()})</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{absentDed.toLocaleString()}</td></tr>}
                {lateDed > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- Late ({values.lateDays}d × {Math.round(perDay / 2).toLocaleString()})</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{lateDed.toLocaleString()}</td></tr>}
                {taxDed > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- Tax</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{taxDed.toLocaleString()}</td></tr>}
                {otherDed > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- {values.otherDeductionLabel || "Other"}</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{otherDed.toLocaleString()}</td></tr>}
                <tr style={{ background: "#fff7f7" }}><td style={{ padding: "4px 6px", border: "1px solid #ddd", fontWeight: "bold" }}>Total Deductions</td><td style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold", color: "#dc2626" }}>-{totalDeductions.toLocaleString()}</td></tr>
                <tr style={{ background: "#1a2a5e", color: "white" }}><td style={{ padding: "6px", border: "1px solid #1a2a5e", fontWeight: "bold" }}>NET SALARY</td><td style={{ padding: "6px", border: "1px solid #1a2a5e", textAlign: "right", fontWeight: "bold" }}>PKR {netSalary.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Salary Slip
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Salaries() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [slipSalary, setSlipSalary] = useState<Salary | null>(null);
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

  const totalPaid = salaries?.filter(s => s.status === "paid").reduce((a, s) => a + s.amount, 0) ?? 0;
  const totalPending = salaries?.filter(s => s.status === "unpaid").reduce((a, s) => a + s.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      {slipSalary && <SalarySlip salary={slipSalary} onClose={() => setSlipSalary(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salaries</h1>
          <p className="text-gray-500 text-sm mt-1">Staff salary management & payslips with deductions</p>
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
                    <FormItem><FormLabel>Basic Salary (PKR) *</FormLabel><FormControl><Input type="number" placeholder="35000" {...field} /></FormControl><FormMessage /></FormItem>
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

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Records", value: (salaries?.length ?? 0).toString(), gradient: "from-blue-500 to-cyan-500", isCurrency: false },
          { label: "Total Paid", value: `PKR ${totalPaid.toLocaleString()}`, gradient: "from-emerald-500 to-green-500", isCurrency: true },
          { label: "Pending", value: `PKR ${totalPending.toLocaleString()}`, gradient: "from-red-500 to-rose-600", isCurrency: true },
        ].map(c => (
          <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br ${c.gradient} p-4`}>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                <p className="text-white text-xl font-bold mt-1">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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
                    {["Staff Member", "Month", "Basic (PKR)", "Paid Date", "Status", "Actions"].map(h => (
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
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => setSlipSalary(sal as Salary)} data-testid={`button-slip-${sal.id}`}>
                            <FileText className="w-3 h-3 mr-1" /> Slip
                          </Button>
                          {sal.status === "unpaid" && (
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handlePay(sal.id)} disabled={payMutation.isPending} data-testid={`button-pay-salary-${sal.id}`}>Pay</Button>
                          )}
                        </div>
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
