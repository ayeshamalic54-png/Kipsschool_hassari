import { useState, useRef } from "react";
import { useListStaff, useCreateStaff, getListStaffQueryKey } from "@workspace/api-client-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Phone, Mail, BookOpen, Pencil, Trash2, Camera, User } from "lucide-react";

const schema = z.object({
  name:     z.string().min(2, "Name required"),
  role:     z.enum(["teacher", "admin", "accountant", "support"]),
  phone:    z.string().optional(),
  email:    z.string().email().optional().or(z.literal("")),
  address:  z.string().optional(),
  subject:  z.string().optional(),
  salary:   z.string().optional(),
  joinDate: z.string().optional(),
  status:   z.enum(["active", "inactive"]).default("active"),
});

type StaffFormValues = z.infer<typeof schema>;

type StaffMember = {
  id: number;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  subject?: string | null;
  salary?: number | string | null;
  joinDate?: string | null;
  status: string;
  username?: string | null;
  imageUrl?: string | null;
};

const roleColors: Record<string, string> = {
  teacher:    "from-blue-500 to-cyan-500",
  admin:      "from-purple-500 to-indigo-500",
  accountant: "from-emerald-500 to-green-500",
  support:    "from-amber-500 to-orange-500",
};

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function StaffFormFields({ control }: { control: ReturnType<typeof useForm<StaffFormValues>>["control"] }) {
  return (
    <>
      <FormField control={control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>Full Name *</FormLabel>
          <FormControl><Input placeholder="Full name" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="role" render={({ field }) => (
        <FormItem>
          <FormLabel>Role *</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="accountant">Accountant</SelectItem>
              <SelectItem value="support">Support</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={control} name="subject" render={({ field }) => (
        <FormItem>
          <FormLabel>Subject</FormLabel>
          <FormControl><Input placeholder="e.g. Mathematics" {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={control} name="phone" render={({ field }) => (
        <FormItem>
          <FormLabel>Phone</FormLabel>
          <FormControl><Input placeholder="0300-1234567" {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl><Input placeholder="email@kips.edu.pk" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="address" render={({ field }) => (
        <FormItem>
          <FormLabel>Address</FormLabel>
          <FormControl><Input placeholder="Full address" {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={control} name="salary" render={({ field }) => (
        <FormItem>
          <FormLabel>Monthly Salary (PKR)</FormLabel>
          <FormControl><Input type="number" placeholder="35000" {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={control} name="joinDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Join Date</FormLabel>
          <FormControl><Input type="date" {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={control} name="status" render={({ field }) => (
        <FormItem>
          <FormLabel>Status</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
    </>
  );
}

export default function Staff() {
  const { toast }    = useToast();
  const queryClient  = useQueryClient();

  const [createOpen,   setCreateOpen]   = useState(false);
  const [editOpen,     setEditOpen]     = useState(false);
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [updating,     setUpdating]     = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  // Photo state for edit dialog
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const { data: staff, isLoading } = useListStaff();
  const createMutation = useCreateStaff();

  const createForm = useForm<StaffFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "teacher", status: "active" },
  });

  const onCreateSubmit = (values: StaffFormValues) => {
    createMutation.mutate({
      data: { ...values, salary: values.salary ? Number(values.salary) : undefined },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        toast({ title: "Staff member added" });
        setCreateOpen(false);
        createForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to add staff" }),
    });
  };

  const editForm = useForm<StaffFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "teacher", status: "active" },
  });

  const openEdit = (member: StaffMember) => {
    setEditTarget(member);
    setPhotoPreview(member.imageUrl ?? null);
    setPhotoFile(null);
    editForm.reset({
      name:     member.name,
      role:     member.role as StaffFormValues["role"],
      phone:    member.phone ?? "",
      email:    member.email ?? "",
      address:  member.address ?? "",
      subject:  member.subject ?? "",
      salary:   member.salary ? String(member.salary) : "",
      joinDate: member.joinDate ?? "",
      status:   member.status as StaffFormValues["status"],
    });
    setEditOpen(true);
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onEditSubmit = async (values: StaffFormValues) => {
    if (!editTarget) return;
    setUpdating(true);
    try {
      const body: Record<string, unknown> = { ...values, salary: values.salary ? Number(values.salary) : null };
      // Include photo if changed
      if (photoFile && photoPreview) body.imageUrl = photoPreview;

      const res = await fetch(`/api/staff/${editTarget.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body:    JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      toast({ title: "Staff member updated" });
      setEditOpen(false);
      setEditTarget(null);
      setPhotoPreview(null);
      setPhotoFile(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to update staff member" });
    } finally {
      setUpdating(false);
    }
  };

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/staff/${deleteTarget.id}`, {
        method: "DELETE", headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      toast({ title: `"${deleteTarget.name}" deleted` });
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to delete staff member" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500 text-sm mt-1">Manage teachers and staff members</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white" data-testid="button-add-staff">
              <Plus className="w-4 h-4 mr-2" /> Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <StaffFormFields control={createForm.control} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add Staff
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Staff Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!staff?.length ? (
            <div className="col-span-full text-center py-16 text-gray-500">No staff members found</div>
          ) : (
            (staff as StaffMember[]).map(member => {
              const grad = roleColors[member.role] ?? "from-gray-500 to-slate-500";
              return (
                <Card key={member.id} className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`card-staff-${member.id}`}>
                  <div className={`h-2 bg-gradient-to-r ${grad}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* Photo avatar */}
                        <div className={`w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm shrink-0`}>
                          {member.imageUrl
                            ? <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : <span className="text-white font-bold text-lg">{member.name.charAt(0)}</span>
                          }
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{member.name}</h3>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">{member.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(member)}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-500 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setDeleteTarget(member); setDeleteOpen(true); }}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      {member.subject && <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-gray-400" />{member.subject}</div>}
                      {member.phone   && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" />{member.phone}</div>}
                      {member.email   && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" />{member.email}</div>}
                      {member.salary  && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">Salary:</span>
                          <span className="font-medium text-gray-800">PKR {Number(member.salary).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        member.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}>{member.status}</span>
                      {member.username && <span className="text-xs font-mono text-gray-400">{member.username}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={v => { setEditOpen(v); if (!v) { setPhotoPreview(null); setPhotoFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Staff — {editTarget?.name}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

              {/* ── Photo Upload ── */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                    {photoPreview
                      ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      : <User className="w-7 h-7 text-gray-400" />
                    }
                  </div>
                  <button type="button" onClick={() => photoRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-colors">
                    <Camera size={11} />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Staff Photo</p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG ya JPG — card pe dikhega</p>
                  <button type="button" onClick={() => photoRef.current?.click()}
                    className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Camera size={11} /> {photoPreview ? "Change Photo" : "Upload Photo"}
                  </button>
                </div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
              </div>

              <StaffFormFields control={editForm.control} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updating} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {updating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This staff member will be permanently deleted. Salary records and attendance may also be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
