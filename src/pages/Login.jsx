import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import logoImg from '../assets/logo.png';
import { verificarAcessoGestor, buscarPermissoesUsuario } from '../api/googleSheets';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  
  // 🔥 NOVO: Estado para controlar o carregamento visual do botão
  const [isLoading, setIsLoading] = useState(false);

  const fazerLogin = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email",
    
    onSuccess: async (tokenResponse) => {
      setIsLoading(true); // Começa a girar o loading
      try {
        const token = tokenResponse.access_token;

        const response = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const emailLogado = response.data.email;

        if (emailLogado.endsWith("@shopee.com") || emailLogado.endsWith("@shopeemobile-external.com")) {
          
          localStorage.setItem("spiToken", token);
          localStorage.setItem("userEmail", emailLogado);
          localStorage.setItem("spiTokenTime", Date.now().toString()); 
          
          // 🔥 MÁGICA DE PERFORMANCE: Dispara as duas buscas no Google Sheets AO MESMO TEMPO
          const [infoUsuario, isGestor] = await Promise.all([
            buscarPermissoesUsuario(emailLogado, token),
            verificarAcessoGestor(emailLogado, token)
          ]);

          if (infoUsuario) {
            localStorage.setItem("userRegional", infoUsuario.regional); 
            localStorage.setItem("userRole", infoUsuario.cargo);
            
            if (isGestor) {
              localStorage.setItem("isGestor", "true");
            } else {
              localStorage.removeItem("isGestor"); 
            }
            
            navigate("/selecionar-regional"); 
            
          } else {
            alert("Seu e-mail não está cadastrado na planilha de permissões.");
          }

        } else {
          alert("Acesso negado. Use seu e-mail corporativo autorizado (@shopee.com ou @shopeemobile-external.com).");
        }
      } catch (error) {
        console.error("Erro ao validar credenciais", error);
        alert("Erro ao validar credenciais no Google.");
      } finally {
        setIsLoading(false); // Para o loading caso dê erro
      }
    },
    onError: () => {
      alert('Erro no Login. Tente novamente.');
      setIsLoading(false);
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#EE4D2D]"></div>

        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-4 h-28 flex items-center justify-center">
            <img 
              src={logoImg} 
              alt="Logo Control Fleet" 
              className="h-full w-auto object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-4xl font-black italic text-[#EE4D2D] uppercase tracking-tighter drop-shadow-sm" style={{ transform: 'skewX(-5deg)' }}>
            CONTROL FLEET
          </h1>
          <p className="text-[10px] font-black text-[#113366] mt-2 uppercase tracking-widest">Acesso Restrito - Logística</p>
        </div>

        <div className="space-y-5">
          <button 
            onClick={() => fazerLogin()}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold py-4 px-4 rounded-xl shadow-sm transition-all ${isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
          >
            {/* 🔥 NOVO: Condicional que troca o ícone do Google pelo Spinner girando */}
            {isLoading ? (
              <>
                <Loader2 className="animate-spin text-[#EE4D2D]" size={20} />
                Validando Acesso...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Entrar com Google Workspace
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}