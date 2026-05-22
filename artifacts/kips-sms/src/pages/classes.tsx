import { useState } from "react";
import { useLocation } from "wouter";
import { useListClasses, useCreateClass, getListClassesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Users, Loader2, ChevronRight, Pencil, Trash2 } from "lucide-react";

const schema = z.object({
  name:     z.string().min(1, "Name is required"),
  grade:    z.string().min(1, "Grade is required"),
  sections: z.string().optional(),
});

type ClassFormValues = z.infer<typeof schema>;

type ClassItem = {
  id: number;
  name: string;
  grade: string;
  sections?: string | null;
  studentCount?: number;
  teacherName?: string | null;
  teacherId?: number | null;
};

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function Classes() {
  const [, setLocation]      = useLocation();
  const { toast }            = useToast();
  const queryClient          = useQueryClient();

  const [createOpen,  setCreateOpen]  = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [editTarget,  setEditTarget]  = useState<ClassItem | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<ClassItem | null>(null);
  const [updating,    setUpdating]    = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const { data: classes, isLoading } = useListClasses();
  const createMutation = useCreateClass();

  // ── Create form ────────────────────────────────────────────────────────────
  const createForm = useForm<ClassFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", grade: "", sections: "" },
  });

  const onCreateSubmit = (values: ClassFormValues) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
        toast({ title: "Class created successfully" });
        setCreateOpen(false);
        createForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create class" }),
    });
  };

  // ── Edit form ──────────────────────────────────────────────────────────────
  const editForm = useForm<ClassFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", grade: "", sections: "" },
  });

  const openEdit = (cls: ClassItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(cls);
    editForm.reset({ name: cls.name, grade: cls.grade, sections: cls.sections ?? "" });
    setEditOpen(true);
  };

  const onEditSubmit = async (values: ClassFormValues) => {
    if (!editTarget) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/classes/${editTarget.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body:    JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
      toast({ title: "Class updated successfully" });
      setEditOpen(false);
      setEditTarget(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to update class" });
    } finally {
      setUpdating(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const openDelete = (cls: ClassItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(cls);
    setDeleteOpen(true);
  };

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/classes/${deleteTarget.id}`, {
        method:  "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
      toast({ title: `"${deleteTarget.name}" deleted` });
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to delete class" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-500 text-sm mt-1">Click a class card to view its students</p>
        </div>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
              data-testid="button-add-class"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Class</DialogTitle></DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Class 6" {...field} data-testid="input-class-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createForm.control} name="grade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Grade 6" {...field} data-testid="input-grade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createForm.control} name="sections" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sections (comma-separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="A,B,C" {...field} data-testid="input-sections" />
                    </FormControl>
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-class">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Class Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : !classes?.length ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No classes found. Add one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes?.map(cls => (
            <Card
              key={cls.id}
              className="hover:shadow-lg transition-all cursor-pointer group border hover:border-indigo-300 hover:-translate-y-0.5"
              onClick={() => setLocation(`/students?classId=${cls.id}`)}
              data-testid={`card-class-${cls.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>

                  {/* Student count + action buttons */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-gray-500 text-sm bg-indigo-50 px-2 py-1 rounded-full">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-bold text-indigo-600">{cls.studentCount ?? 0}</span>
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={(e) => openEdit(cls as ClassItem, e)}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-500 transition-colors"
                      title="Edit class"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => openDelete(cls as ClassItem, e)}
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-500 transition-colors"
                      title="Delete class"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="mt-3 font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  {cls.name}
                </h3>
                <p className="text-sm text-gray-500">{cls.grade}</p>

                {cls.sections && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cls.sections.split(",").map(s => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium border border-indigo-100"
                      >
                        Section {s.trim()}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center text-xs text-indigo-400 group-hover:text-indigo-600 transition-colors font-medium">
                  <span>View Students</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Class 6" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="grade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade *</FormLabel>
                  <FormControl><Input placeholder="e.g. Grade 6" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="sections" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sections (comma-separated)</FormLabel>
                  <FormControl><Input placeholder="A,B,C" {...field} /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updating} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {updating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This class will be permanently deleted. If this class has students, transfer them to another class first. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}