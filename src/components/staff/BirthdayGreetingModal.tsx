import React, { useState, useEffect } from 'react';
import { X, Gift } from 'lucide-react';

interface BirthdayGreetingModalProps {
  staffName: string;
  onClose: () => void;
}

export const BirthdayGreetingModal: React.FC<BirthdayGreetingModalProps> = ({ staffName, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative border-2 border-[#FFC700] text-center space-y-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600">
          <X className="w-5 h-5" />
        </button>
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-3xl">
          🎂
        </div>
        <h2 className="text-2xl font-black text-[#4D080F]">Happy Birthday, {staffName}!</h2>
        <p className="text-sm text-stone-600 font-montserrat leading-relaxed">
          The entire Choplife Republic team wishes you a fantastic day and a wonderful year ahead! Thank you for your dedication.
        </p>
        <div className="pt-2">
          <button 
            onClick={onClose}
            className="w-full bg-[#E62E00] hover:bg-[#C92200] text-white font-bold py-3 rounded-xl transition-all"
          >
            Thank You!
          </button>
        </div>
      </div>
    </div>
  );
};
