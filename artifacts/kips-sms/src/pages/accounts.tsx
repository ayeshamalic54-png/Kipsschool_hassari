import { useState } from "react";
import { useListIncome, useListExpenses, useCreateIncome, useCreateExpense, useGetAccountSummary, getListIncomeQueryKey, getListExpensesQueryKey, getGetAccountSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Printer, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const schema = z.object({
  amount: z.string().min(1, "Amount required"),
  category: z.string().min(1, "Category required"),
  description: z.string().min(1, "Description required"),
  date: z.string().min(1, "Date required"),
});

export default function Accounts() {
  const [tab, setTab] = useState("summary");
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useGetAccountSummary({ month: currentMonth });
  const { data: income, isLoading: incomeLoading } = useListIncome({ month: currentMonth });
  const { data: expenses, isLoading: expensesLoading } = useListExpenses({ month: currentMonth });
  const createIncome = useCreateIncome();
  const createExpense = useCreateExpense();

  const incomeForm = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split("T")[0] },
  });
  const expenseForm = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split("T")[0] },
  });

  const onAddIncome = (values: z.infer<typeof schema>) => {
    createIncome.mutate({ data: { ...values, amount: Number(values.amount) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIncomeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountSummaryQueryKey() });
        toast({ title: "Income recorded" });
        setAddIncomeOpen(false);
        incomeForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to record income" }),
    });
  };

  const onAddExpense = (values: z.infer<typeof schema>) => {
    createExpense.mutate({ data: { ...values, amount: Number(values.amount) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountSummaryQueryKey() });
        toast({ title: "Expense recorded" });
        setAddExpenseOpen(false);
        expenseForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to record expense" }),
    });
  };

  const EntryForm = ({ form, onSubmit, isPending, type }: { form: ReturnType<typeof useForm<z.infer<typeof schema>>>, onSubmit: (v: z.infer<typeof schema>) => void, isPending: boolean, type: string }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="amount" render={({ field }) => (
          <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" placeholder="10000" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem><FormLabel>Category *</FormLabel><FormControl><Input placeholder={type === "income" ? "Fee Collection, Donations..." : "Salaries, Utilities..."} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description *</FormLabel><FormControl><Input placeholder="Description..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="date" render={({ field }) => (
          <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
          </Button>
        </div>
      </form>
    </Form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 text-sm mt-1">Income and expense management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-accounts"><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Dialog open={addIncomeOpen} onOpenChange={setAddIncomeOpen}>
            <DialogTrigger asChild><Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid="button-add-income"><Plus className="w-4 h-4 mr-1" /> Income</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Add Income</DialogTitle></DialogHeader><EntryForm form={incomeForm} onSubmit={onAddIncome} isPending={createIncome.isPending} type="income" /></DialogContent>
          </Dialog>
          <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
            <DialogTrigger asChild><Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" data-testid="button-add-expense"><Plus className="w-4 h-4 mr-1" /> Expense</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader><EntryForm form={expenseForm} onSubmit={onAddExpense} isPending={createExpense.isPending} type="expense" /></DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Income", value: summary?.totalIncome, gradient: "from-emerald-500 to-green-500", icon: TrendingUp },
          { label: "Total Expenses", value: summary?.totalExpenses, gradient: "from-red-500 to-rose-500", icon: TrendingDown },
          { label: "Net Profit", value: summary?.netProfit, gradient: "from-purple-500 to-indigo-600", icon: DollarSign },
        ].map(card => (
          <Card key={card.label} className={`bg-gradient-to-br ${card.gradient} border-0`}>
            <CardContent className="p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/80 text-sm font-medium">{card.label}</p>
                <card.icon className="w-5 h-5 text-white/70" />
              </div>
              {summaryLoading ? <div className="h-7 bg-white/20 rounded animate-pulse" /> : (
                <p className="text-2xl font-bold">PKR {(card.value ?? 0).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="income">
          <Card><CardContent className="p-0">
            {incomeLoading ? <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
              <table className="w-full text-sm">
                <thead className="bg-emerald-50"><tr>{["Date","Category","Description","Amount (PKR)"].map(h => <th key={h} className="text-left py-3 px-3 font-semibold text-emerald-800">{h}</th>)}</tr></thead>
                <tbody>
                  {!income?.length ? <tr><td colSpan={4} className="py-8 text-center text-gray-400">No income records</td></tr>
                    : income?.map(entry => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50" data-testid={`row-income-${entry.id}`}>
                        <td className="py-2.5 px-3 text-gray-600">{entry.date}</td>
                        <td className="py-2.5 px-3 text-gray-700">{entry.category}</td>
                        <td className="py-2.5 px-3 text-gray-600">{entry.description}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">PKR {entry.amount.toLocaleString()}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="expenses">
          <Card><CardContent className="p-0">
            {expensesLoading ? <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
              <table className="w-full text-sm">
                <thead className="bg-red-50"><tr>{["Date","Category","Description","Amount (PKR)"].map(h => <th key={h} className="text-left py-3 px-3 font-semibold text-red-800">{h}</th>)}</tr></thead>
                <tbody>
                  {!expenses?.length ? <tr><td colSpan={4} className="py-8 text-center text-gray-400">No expense records</td></tr>
                    : expenses?.map(entry => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50" data-testid={`row-expense-${entry.id}`}>
                        <td className="py-2.5 px-3 text-gray-600">{entry.date}</td>
                        <td className="py-2.5 px-3 text-gray-700">{entry.category}</td>
                        <td className="py-2.5 px-3 text-gray-600">{entry.description}</td>
                        <td className="py-2.5 px-3 font-bold text-red-600">PKR {entry.amount.toLocaleString()}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
