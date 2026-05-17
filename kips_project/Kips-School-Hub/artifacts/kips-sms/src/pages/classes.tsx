import { useState } from "react";
import { useListClasses, useCreateClass, getListClassesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Users, Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  grade: z.string().min(1, "Grade is required"),
  sections: z.string().optional(),
});

export default function Classes() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: classes, isLoading } = useListClasses();
  const createMutation = useCreateClass();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", grade: "", sections: "" },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
        toast({ title: "Class created successfully" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create class" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-500 text-sm mt-1">Manage classes and sections</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white" data-testid="button-add-class">
              <Plus className="w-4 h-4 mr-2" /> Add Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Class</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Class Name *</FormLabel><FormControl><Input placeholder="e.g. Class 6" {...field} data-testid="input-class-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="grade" render={({ field }) => (
                  <FormItem><FormLabel>Grade *</FormLabel><FormControl><Input placeholder="e.g. Grade 6" {...field} data-testid="input-grade" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="sections" render={({ field }) => (
                  <FormItem><FormLabel>Sections (comma-separated)</FormLabel><FormControl><Input placeholder="A,B,C" {...field} data-testid="input-sections" /></FormControl></FormItem>
                )} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-class">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes?.map(cls => (
            <Card key={cls.id} className="hover:shadow-md transition-shadow" data-testid={`card-class-${cls.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 text-sm">
                    <Users className="w-3.5 h-3.5" />
                    <span>{cls.studentCount}</span>
                  </div>
                </div>
                <h3 className="mt-3 font-bold text-gray-900">{cls.name}</h3>
                <p className="text-sm text-gray-500">{cls.grade}</p>
                {cls.sections && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cls.sections.split(",").map(s => (
                      <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium border border-indigo-100">Section {s.trim()}</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
