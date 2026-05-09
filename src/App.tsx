import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Home from '@/pages/Home'
import Questionnaire from '@/pages/Questionnaire'
import ReevaluateQuestionnaire from '@/pages/ReevaluateQuestionnaire'
import Results from '@/pages/Results'
import History from '@/pages/History'
import Generating from '@/pages/Generating'
import Diet from '@/pages/Diet'
import Chat from '@/pages/Chat'
import ImportPlan from '@/pages/ImportPlan'
import Support from '@/pages/Support'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/reevaluate" element={<ReevaluateQuestionnaire />} />
            <Route path="/generating" element={<Generating />} />
            <Route path="/results" element={<Results />} />
            <Route path="/history" element={<History />} />
            <Route path="/diet" element={<Diet />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/import" element={<ImportPlan />} />
          <Route path="/support" element={<Support />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
