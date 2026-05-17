import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateStudent, useListClasses, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  section: z.string().optional(),
  rollNumber: z.string().optional(),
  feeAmount: z.string().optional(),
  status: z.enum(["active", "inactive", "left"]).default("active"),
});

export default function StudentNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: classes } = useListClasses();
  const createMutation = useCreateStudent();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", status: "active" },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMutation.mutate({
      data: {
        ...values,
        classId: Number(values.classId),
        feeAmount: values.feeAmount ? Number(values.feeAmount) : undefined,
      }
    }, {
      onSuccess: (student) => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student admitted successfully!", description: `Admission No: ${student.admissionNumber}` });
        setLocation("/students");
      },
      onError: () => toast({ variant: "destructive", title: "Failed to add student" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Student Admission</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in the admission form</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl><Input placeholder="Student full name" {...field} data-testid="input-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fatherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Father Name</FormLabel>
                  <FormControl><Input placeholder="Father's name" {...field} data-testid="input-father-name" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="motherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mother Name</FormLabel>
                  <FormControl><Input placeholder="Mother's name" {...field} data-testid="input-mother-name" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-dob" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-gender"><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="0300-1234567" {...field} data-testid="input-phone" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl><Input placeholder="Emergency number" {...field} data-testid="input-emergency" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input placeholder="Full address" {...field} data-testid="input-address" /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Academic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-class"><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes?.map(cls => (
                        <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <FormControl><Input placeholder="A, B, C..." {...field} data-testid="input-section" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="rollNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Roll Number</FormLabel>
                  <FormControl><Input placeholder="Roll number" {...field} data-testid="input-roll" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="feeAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Fee (PKR)</FormLabel>
                  <FormControl><Input type="number" placeholder="2500" {...field} data-testid="input-fee" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/students")}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white" data-testid="button-submit">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Admit Student
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
