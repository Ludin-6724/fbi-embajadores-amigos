import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Users, ArrowRight, CheckCircle } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

export default async function JoinByInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const supabase = await createClient();
  const { code } = await params;

  const { data: { user } } = await supabase.auth.getUser();

  // Buscar comunidad por invite_code
  const { data: community } = await supabase
    .from("communities")
    .select("id, name, description, is_official, owner_id, is_private, invite_code")
    .eq("invite_code", code.toUpperCase())
    .single();

  if (!community) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-cream flex items-center justify-center p-8">
          <div className="bg-white rounded-3xl p-12 max-w-md w-full text-center shadow-lg border border-red-100">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-navy-dark mb-3">
              Código inválido
            </h1>
            <p className="font-sans text-navy-dark/60 mb-8">
              Este link de invitación no existe o ya caducó. Pide un nuevo link al administrador del grupo.
            </p>
            <Link href="/" className="bg-navy-dark text-white px-6 py-3 rounded-full font-sans font-semibold hover:bg-navy-dark/90 transition-colors">
              Volver al inicio
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Si no está logueado, redirigir a login con callback
  if (!user) {
    redirect(`/?joinCode=${code}`);
  }

  // Verificar si ya es miembro
  const { data: existingMember } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", community.id)
    .eq("user_id", user.id)
    .single();

  let joinSuccess = false;
  let alreadyMember = !!existingMember;

  if (!existingMember) {
    // Agregar como miembro directamente (invite link bypasa privacidad)
    const { error } = await supabase.from("community_members").insert({
      community_id: community.id,
      user_id: user.id,
      role: "member",
    });

    if (!error) joinSuccess = true;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl p-12 max-w-md w-full text-center shadow-lg border border-gold/20">
          {/* Badge de tipo */}
          <div className="flex justify-center mb-6">
            <div className="bg-gold/10 text-gold px-4 py-2 rounded-full text-sm font-bold font-sans flex items-center gap-2">
              {community.is_official ? (
                <><Shield size={14} /> Comunidad Oficial</>
              ) : (
                <><Users size={14} /> Grupo de Misión</>
              )}
            </div>
          </div>

          <h1 className="font-serif text-3xl font-bold text-navy-dark mb-3">
            {community.name}
          </h1>
          <p className="font-sans text-navy-dark/60 mb-8 leading-relaxed">
            {community.description || "Un grupo de creyentes en misión activa."}
          </p>

          {alreadyMember ? (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle size={22} />
                <p className="font-sans font-semibold">Ya eres parte de esta comunidad.</p>
              </div>
              <Link
                href={`/c/${community.id}`}
                className="inline-flex items-center gap-2 bg-navy-dark text-white px-6 py-3 rounded-full font-sans font-semibold hover:bg-navy-dark/90 transition-colors shadow-md"
              >
                Ir a la sede <ArrowRight size={16} />
              </Link>
            </div>
          ) : joinSuccess ? (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <div>
                <p className="font-serif text-xl font-bold text-navy-dark mb-2">
                  ¡Bienvenido al grupo! 🎉
                </p>
                <p className="font-sans text-navy-dark/60 text-sm">
                  Ahora eres parte de {community.name}.
                </p>
              </div>
              <Link
                href={`/c/${community.id}`}
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-white px-8 py-3 rounded-full font-sans font-semibold transition-colors shadow-md"
              >
                Entrar a la sede <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="text-red-500 font-sans">
              Ocurrió un error al unirte. Intenta de nuevo.
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
