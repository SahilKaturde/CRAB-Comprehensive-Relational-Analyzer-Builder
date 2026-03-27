import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo/CRAB_LOGO.png';
import { authService } from '../api/auth';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await authService.login(formData);
      setMessage(`Logged in successfully!`);
      setTimeout(() => navigate('/chat'), 1000);
    } catch (error) {
      setMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-5">
      <div className="flex justify-center mb-14">
        <img src={logo} alt="CRAB Logo" className="h-20 w-auto object-contain" />
      </div>

      <div className="max-w-[450px] w-full text-center">
        <h1 className="text-[3.5rem] font-black leading-[0.9] uppercase mb-5 text-left -tracking-wider text-[#1a1a1a]">
          ANALYZE<br />
          BETTER WITH<br />
          <span className="font-heading text-[2rem] tracking-normal block mt-4 text-crab-accent">CRAB</span>
        </h1>
        
        <p className="font-mono text-base font-normal text-black text-left mb-10 leading-relaxed">
          The ultimate AI-powered platform for deep CSV analysis. 
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleLogin}>
          {message && <div className="mb-4 font-extrabold text-crab-accent font-mono text-xs text-left">{message}</div>}
          <div className="text-left">
            <input 
              type="text" 
              name="username"
              placeholder="Username" 
              className="brutalist-input"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="text-left">
            <input 
              type="email" 
              name="email"
              placeholder="Email address" 
              className="brutalist-input"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="text-left">
            <input 
              type="password" 
              name="password"
              placeholder="Password" 
              className="brutalist-input"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          
          <button type="submit" className="mt-2 brutalist-btn-primary" disabled={loading}>
            {loading ? 'ANALYZING...' : 'LOGIN'}
          </button>
          <button 
            type="button" 
            className="brutalist-btn-secondary"
            onClick={() => navigate('/register')}
          >
            CREATE ACCOUNT
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
