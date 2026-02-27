import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, FileText, Clock, User, Building2 } from 'lucide-react';

export default function AdmissionLanding() {
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const steps = [
    {
      icon: FileText,
      title: 'Complete Form',
      description: 'Fill out the admission application with student and parent details'
    },
    {
      icon: Clock,
      title: 'Submit & Wait',
      description: 'Application is reviewed by our admission team'
    },
    {
      icon: Check,
      title: 'Get Approved',
      description: 'Receive confirmation and login credentials via email'
    }
  ];

  const features = [
    'Easy online application process',
    'Document upload support',
    'Real-time status tracking',
    'Instant approval notifications',
    'Secure parent login credentials'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">BVM School</span>
          </div>
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="outline" size="sm">Back</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
          Welcome to BVM School
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Join our community of excellence. Apply for admission today and give your child the best education.
        </p>
        <Link to={createPageUrl('PublicAdmissionForm')}>
          <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg px-8">
            Start Application
          </Button>
        </Link>
      </section>

      {/* Process Steps */}
      <section className="bg-white py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="relative">
                  <Card className="h-full">
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Icon className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 text-lg">{step.title}</h3>
                      <p className="text-gray-600 text-sm">{step.description}</p>
                    </CardContent>
                  </Card>
                  {idx < steps.length - 1 && (
                    <div className="hidden md:block absolute top-12 -right-4 w-8 h-8 bg-blue-600 rounded-full text-white flex items-center justify-center font-bold z-10">
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Why Choose BVM?</h2>
        <Card className="border-2">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">{feature}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* About Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16 sm:py-20 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold mb-2">25+</p>
              <p className="text-blue-100">Years of Excellence</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">2000+</p>
              <p className="text-blue-100">Students</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">50+</p>
              <p className="text-blue-100">Faculty Members</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Apply?</h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Fill out the admission form and our team will get back to you within 3-5 business days.
        </p>
        <Link to={createPageUrl('PublicAdmissionForm')}>
          <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg px-8">
            Apply Now
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p>&copy; 2026 BVM School of Excellence. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}