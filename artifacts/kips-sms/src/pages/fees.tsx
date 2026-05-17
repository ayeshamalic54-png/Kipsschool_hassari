import { useState } from "react";
import { useListFees, useCreateFee, usePayFee, useListStudents, getListFeesQueryKey } from "@workspace/api-client-react";
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
import { Plus, Loader2, CheckCircle, Clock, AlertCircle, Printer } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

const statusConfig = {
  paid: { icon: CheckCircle, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  unpaid: { icon: AlertCircle, className: "bg-red-100 text-red-700 border-red-200" },
  partial: { icon: Clock, className: "bg-amber-100 text-amber-700 border-amber-200" },
};

const addFeeSchema = z.object({
  studentId: z.string().min(1, "Student required"),
  amount: z.string().min(1, "Amount required"),
  month: z.string().min(1, "Month required"),
  dueDate: z.string().min(1, "Due date required"),
  fine: z.string().optional(),
});

interface Receipt {
  receiptNo: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  month: string;
  amountPaid: number;
  remaining: number;
  newStatus: string;
  paidDate: string;
}

export default function Fees() {
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isStudent = user?.role === "student";

  const { data: fees, isLoading } = useListFees(statusFilter ? { status: statusFilter as "paid" | "unpaid" | "partial" } : {});
  const { data: students } = useListStudents({});
  const createMutation = useCreateFee();
  const payMutation = usePayFee();

  const currentFee = fees?.find(f => f.id === payOpen);

  const form = useForm<z.infer<typeof addFeeSchema>>({
    resolver: zodResolver(addFeeSchema),
    defaultValues: { fine: "0" },
  });

  const onSubmit = (values: z.infer<typeof addFeeSchema>) => {
    createMutation.mutate({
      data: {
        studentId: Number(values.studentId),
        amount: Number(values.amount),
        month: values.month,
        dueDate: values.dueDate,
        fine: Number(values.fine ?? 0),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        toast({ title: "Fee record created" });
        setAddOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create fee record" }),
    });
  };

  const handlePay = () => {
    if (!payOpen || !payAmount || !currentFee) return;
    const paid = Number(payAmount);
    payMutation.mutate({ id: payOpen, data: { paidAmount: paid } }, {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        const totalPaid = (currentFee.paidAmount ?? 0) + paid;
        const remaining = currentFee.amount - totalPaid;
        setReceipt({
          receiptNo: `RCP-${Date.now().toString().slice(-6)}`,
          studentName: currentFee.studentName ?? "—",
          admissionNumber: currentFee.admissionNumber ?? "—",
          className: currentFee.className ?? "—",
          month: currentFee.month,
          amountPaid: paid,
          remaining: Math.max(0, remaining),
          newStatus: remaining <= 0 ? "paid" : "partial",
          paidDate: new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
        });
        setPayOpen(null);
        setPayAmount("");
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage student fees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          {!isStudent && <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-600 to-green-600 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Fee Record
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Fee Record</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="studentId" render={({ field }) => (
                    <FormItem><FormLabel>Student *</FormLabel>
                      <Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                        <SelectContent>{students?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.admissionNumber})</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" placeholder="2500" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="month" render={({ field }) => (
                    <FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="dueDate" render={({ field }) => (
                    <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="fine" render={({ field }) => (
                    <FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap no-print">
        {[{ val: undefined, label: "All" }, { val: "paid", label: "Paid" }, { val: "unpaid", label: "Unpaid" }, { val: "partial", label: "Partial" }].map(f => (
          <Button key={f.label} size="sm" variant={statusFilter === f.val ? "default" : "outline"} onClick={() => setStatusFilter(f.val)}>{f.label}</Button>
        ))}
      </div>

      <div className="print-header hidden print:block mb-4">
        <div className="flex items-center gap-4 border-b pb-4">
          <img src="/kips-logo.jpeg" alt="KIPS" className="w-14 h-14 rounded-full object-cover" />
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#1a2a5e" }}>KIPS School Hassari</h2>
            <p className="text-sm text-gray-500">Fee Report — {new Date().toLocaleDateString("en-PK", { dateStyle: "long" })}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {["Student", "Adm#", "Class", "Month", "Amount", "Paid", "Remaining", "Fine", "Due Date", "Status", "Action"].map(h => (
                      <th key={h} className={`text-left py-3 px-3 font-semibold text-gray-600 ${h === "Action" ? "print:hidden" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fees?.map(fee => {
                    const st = statusConfig[fee.status as keyof typeof statusConfig] || statusConfig.unpaid;
                    return (
                      <tr key={fee.id} className="border-b hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{fee.studentName || "—"}</td>
                        <td className="py-2.5 px-3 text-xs font-mono text-purple-600">{fee.admissionNumber || "—"}</td>
                        <td className="py-2.5 px-3 text-gray-600">{fee.className || "—"}</td>
                        <td className="py-2.5 px-3 text-gray-600">{fee.month}</td>
                        <td className="py-2.5 px-3 font-medium">PKR {fee.amount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-emerald-600">PKR {(fee.paidAmount ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-semibold text-red-600">PKR {(fee.remainingAmount ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-orange-600">{(fee.fine ?? 0) > 0 ? `PKR ${(fee.fine ?? 0).toLocaleString()}` : "—"}</td>
                        <td className="py-2.5 px-3 text-gray-500">{fee.dueDate}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${st.className}`}>{fee.status}</span>
                        </td>
                        <td className="py-2.5 px-3 print:hidden">
                          {!isStudent && fee.status !== "paid" && (
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setPayOpen(fee.id); setPayAmount(String(fee.remainingAmount ?? 0)); }}>Pay</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={!!payOpen} onOpenChange={() => { setPayOpen(null); setPayAmount(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {currentFee && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Student:</span><span className="font-medium">{currentFee.studentName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Month:</span><span>{currentFee.month}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Fee:</span><span className="font-medium">PKR {currentFee.amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Already Paid:</span><span className="text-emerald-600">PKR {(currentFee.paidAmount ?? 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-gray-700">Remaining:</span><span className="text-red-600">PKR {(currentFee.remainingAmount ?? 0).toLocaleString()}</span></div>
                {(currentFee.fine ?? 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Fine:</span><span className="text-orange-600">PKR {(currentFee.fine ?? 0).toLocaleString()}</span></div>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Amount to Pay Now (PKR)</label>
                <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="mt-1" placeholder="Enter amount" max={currentFee.remainingAmount ?? currentFee.amount} />
                {payAmount && Number(payAmount) < (currentFee.remainingAmount ?? 0) && (
                  <p className="text-xs text-amber-600 mt-1">Partial payment — PKR {((currentFee.remainingAmount ?? 0) - Number(payAmount)).toLocaleString()} will remain</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPayOpen(null)}>Cancel</Button>
                <Button onClick={handlePay} disabled={payMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {payMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Confirm Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
          {receipt && (
            <div>
              <div id="receipt-print" className="border rounded-xl p-5 bg-white text-sm space-y-3">
                <div className="flex items-center gap-3 border-b pb-3">
                  <img src="/kips-logo.jpeg" alt="KIPS" className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: "#e07b1a" }} />
                  <div>
                    <p className="font-bold text-base" style={{ color: "#1a2a5e" }}>KIPS School Hassari</p>
                    <p className="text-xs text-gray-400">Fee Receipt</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Receipt No.</span><span className="font-mono font-semibold text-gray-800">{receipt.receiptNo}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Date</span><span className="text-gray-700">{receipt.paidDate}</span>
                </div>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Student</span><span className="font-medium text-gray-900">{receipt.studentName}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Adm. No.</span><span className="font-mono text-purple-600">{receipt.admissionNumber}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Class</span><span className="text-gray-700">{receipt.className}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Month</span><span className="text-gray-700">{receipt.month}</span></div>
                </div>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm font-semibold text-emerald-600">
                    <span>Amount Paid</span><span>PKR {receipt.amountPaid.toLocaleString()}</span>
                  </div>
                  {receipt.remaining > 0 ? (
                    <div className="flex justify-between text-sm font-semibold text-red-600">
                      <span>Remaining Balance</span><span>PKR {receipt.remaining.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm font-semibold text-emerald-600">
                      <span>Status</span><span>✓ FULLY PAID</span>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3 text-center">
                  <p className="text-xs text-gray-400">Cashier: ________________</p>
                  <p className="text-[10px] text-gray-300 mt-1">Thank you for your payment</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setReceipt(null)}>Close</Button>
                <Button className="flex-1" style={{ background: "#1a2a5e", color: "#fff" }} onClick={() => {
                  const el = document.getElementById("receipt-print");
                  if (!el) return;
                  const w = window.open("", "_blank");
                  if (!w) return;
                  w.document.write(`<html><head><title>Fee Receipt</title><style>body{font-family:sans-serif;padding:20px;max-width:400px;margin:auto}img{border-radius:50%;border:2px solid #e07b1a}@media print{body{padding:0}}</style></head><body>${el.outerHTML}<script>window.print();window.close()<\/script></body></html>`);
                  w.document.close();
                }}>
                  <Printer className="w-4 h-4 mr-2" /> Print Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
