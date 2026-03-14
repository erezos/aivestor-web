import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';


export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await base44.auth.me();
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });
    
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0f]">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="relative">
                    <div className="text-[120px] font-black leading-none bg-gradient-to-b from-violet-400/60 to-transparent bg-clip-text text-transparent select-none">404</div>
                    <div className="absolute inset-0 blur-3xl bg-violet-600/10 rounded-full" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Lost in the market?</h2>
                    <p className="text-white/40 text-sm leading-relaxed">
                        The page <span className="text-violet-400 font-medium">"{pageName}"</span> doesn't exist in AIVestor.
                    </p>
                </div>
                {isFetched && authData?.isAuthenticated && authData?.user?.role === 'admin' && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left">
                        <p className="text-xs font-bold text-amber-400 mb-1">Admin Note</p>
                        <p className="text-xs text-white/40">This page hasn't been implemented yet. Ask the AI to build it.</p>
                    </div>
                )}
                <button
                    onClick={() => window.location.href = '/'}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold hover:opacity-90 transition-opacity"
                >
                    ← Back to AIVestor
                </button>
            </div>
        </div>
    )
}