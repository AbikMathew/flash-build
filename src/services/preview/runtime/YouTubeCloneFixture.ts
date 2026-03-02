import { ProjectFile } from '@/types';

export const YOUTUBE_CLONE_FIXTURE: ProjectFile[] = [
  {
    path: 'App.tsx',
    language: 'tsx',
    content: `import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import VideoPlayer from './components/VideoPlayer';

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar logo="https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg" profileImage="https://ui-avatars.com/api/?name=User" />
      <div className="flex flex-1 overflow-hidden mt-16">
        <Sidebar categories={['Home', 'Shorts', 'Subscriptions']} playlists={['Liked Videos', 'Watch Later']} />
        <main className="flex-1 overflow-y-auto bg-slate-950 ml-[5rem] md:ml-[16rem]">
          <Routes>
            <Route path="/" element={<VideoGrid />} />
            <Route path="/category/:id" element={<VideoGrid />} />
            <Route path="/video/:id" element={<VideoPlayer videoUrl="https://www.w3schools.com/html/mov_bbb.mp4" title="Sample" channel="Channel" viewCount={100} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;`
  },
  {
    path: 'index.html',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>YouTube Clone</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`
  },
  {
    path: 'index.tsx',
    language: 'tsx',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);`
  },
  {
    path: 'styles.css',
    language: 'css',
    content: `body {
  font-family: 'Inter', sans-serif;
  background-color: #020617; /* slate-950 */
}

/* FlashBuild responsive overflow guard */
html, body, #root {
  max-width: 100%;
  overflow-x: hidden;
}

img, svg, canvas, video {
  max-width: 100%;
  height: auto;
}

.transition-width {
  transition-property: width;
}`
  },
  {
    path: 'components/Navbar.tsx',
    language: 'tsx',
    content: `import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import useVideoStore from '../videoStore';

interface NavbarProps {
  logo: string;
  profileImage: string;
}

const Navbar: React.FC<NavbarProps> = ({ logo, profileImage }) => {
  const [searchInput, setSearchInput] = useState('');
  const filterVideos = useVideoStore((state) => state.filterVideos);

  const handleSearch = () => {
    filterVideos(searchInput);
  };

  return (
    <nav className="flex items-center justify-between p-4 bg-slate-900 fixed top-0 left-0 right-0 shadow-md z-10 w-full">
      <Link to="/" className="flex items-center ml-2 md:ml-4">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center mr-2">
          <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-white border-b-4 border-b-transparent ml-1"></div>
        </div>
        <span className="text-white font-bold text-xl tracking-tight hidden sm:block">YouTube</span>
      </Link>
      <div className="flex items-center flex-1 justify-center max-w-2xl px-4">
        <div className="flex items-center w-full bg-slate-800 border border-slate-700 rounded-full overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search"
            className="w-full p-2.5 px-4 bg-transparent text-white focus:outline-none"
          />
          <button onClick={handleSearch} className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700 border-l border-slate-700 transition-colors">
            <Search size={20} className="text-slate-300" />
          </button>
        </div>
      </div>
      <div className="flex items-center space-x-4 pr-2">
        <img src={profileImage} alt="Profile" className="w-8 h-8 rounded-full border border-slate-700" />
      </div>
    </nav>
  );
};

export default Navbar;`
  },
  {
    path: 'components/Sidebar.tsx',
    language: 'tsx',
    content: `import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, Compass, PlaySquare, Clock, ThumbsUp, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SidebarProps {
  categories: string[];
  playlists: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ categories, playlists }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const icons = [<Home size={22} />, <Compass size={22} />, <PlaySquare size={22} />, <Clock size={22} />, <ThumbsUp size={22} />];

  return (
    <div className={\`bg-slate-900 border-r border-slate-800 \${isExpanded ? 'w-64' : 'w-[5rem]'} transition-width duration-300 fixed top-16 left-0 bottom-0 overflow-y-auto z-10 hidden sm:block\`}>
      <button onClick={() => setIsExpanded(!isExpanded)} className="p-4 w-full flex justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
        <Menu size={24} />
      </button>
      <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
          <ul className="py-2">
            {categories.map((category, i) => (
              <li key={category}>
                <Link to="/" className={\`flex items-center \${isExpanded ? 'px-6 py-3 space-x-4' : 'flex-col py-4 space-y-1'} text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer\`}>
                  {icons[i % Object.keys(icons).length]}
                  <span className={\`font-medium \${isExpanded ? 'text-sm' : 'text-[10px]'}\`}>{category}</span>
                </Link>
              </li>
            ))}
          </ul>
          {isExpanded && (
            <>
              <hr className="border-slate-800 my-2 mx-4"/>
              <h3 className="px-6 py-2 text-slate-400 font-bold text-sm uppercase tracking-wider">Playlists</h3>
              <ul className="py-2">
                {playlists.map(playlist => (
                  <li key={playlist} className="px-6 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer flex items-center space-x-4">
                    <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                    <span className="font-medium text-sm truncate">{playlist}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;`
  },
  {
    path: 'components/CommentsSection.tsx',
    language: 'tsx',
    content: `import React, { useState } from 'react';

interface CommentsSectionProps {
  videoId: string;
}

interface Comment {
  author: string;
  text: string;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ videoId }) => {
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([
    { author: '@TechEnthusiast', text: 'This feature completely blew my mind. The implementation is so clean!' },
    { author: '@WebDevPro', text: 'Can we get a tutorial on how you configured the build pipeline?' },
    { author: '@DesignNerd', text: 'The gradients and animations are spot on. Really premium feel.' },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      setComments([{ author: '@CurrentUser', text: newComment }, ...comments]);
      setNewComment('');
    }
  };

  return (
    <div className="mt-6 border-t border-slate-800 pt-6">
      <h2 className="text-white font-bold text-xl mb-6">{comments.length} Comments</h2>
      <form onSubmit={handleSubmit} className="mb-8 flex space-x-4 items-start">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold">U</div>
        <div className="flex-1">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-transparent border-b border-slate-700 text-white placeholder-slate-500 focus:border-white focus:outline-none pb-2 transition-colors"
          />
          {newComment && (
            <div className="flex justify-end space-x-3 mt-3">
              <button type="button" onClick={() => setNewComment('')} className="px-4 py-2 hover:bg-slate-800 rounded-full text-slate-300 font-medium text-sm transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-black font-medium text-sm rounded-full transition-colors">Comment</button>
            </div>
          )}
        </div>
      </form>
      <div className="space-y-6">
        {comments.map((comment, index) => (
          <div key={index} className="flex space-x-4">
             <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-white font-bold">{comment.author.charAt(1).toUpperCase()}</div>
             <div>
               <div className="flex items-center space-x-2 mb-1">
                 <p className="text-white font-semibold text-sm">{comment.author}</p>
                 <span className="text-slate-400 text-xs">2 hours ago</span>
               </div>
               <p className="text-slate-300 text-sm leading-relaxed">{comment.text}</p>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentsSection;`
  },
  {
    path: 'components/VideoCard.tsx',
    language: 'tsx',
    content: `import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface VideoCardProps {
  id: string;
  thumbnail: string;
  title: string;
  channel: string;
  viewCount: number;
}

const VideoCard: React.FC<VideoCardProps> = ({ id, thumbnail, title, channel, viewCount }) => {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
      <Link to={\`/video/\${id}\`} className="flex flex-col group cursor-pointer">
        <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3">
          <img src={thumbnail} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">12:34</div>
        </div>
        <div className="flex space-x-3 pr-6">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex-shrink-0 border border-slate-600"></div>
          <div className="flex flex-col items-start">
            <h3 className="font-semibold text-white text-base leading-tight mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors">{title}</h3>
            <p className="text-slate-400 text-sm hover:text-white transition-colors">{channel}</p>
            <p className="text-slate-400 text-sm">{(viewCount / 1000).toFixed(1)}K views • 2 weeks ago</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default VideoCard;`
  },
  {
    path: 'components/VideoGrid.tsx',
    language: 'tsx',
    content: `import React, { useEffect } from 'react';
import VideoCard from './VideoCard';
import useVideoStore from '../videoStore';

const VideoGrid: React.FC = () => {
  const videos = useVideoStore((state) => state.videos);
  const filteredVideos = useVideoStore((state) => state.filteredVideos);
  const filterVideos = useVideoStore((state) => state.filterVideos);
  
  useEffect(() => {
    // Initialize
    if (filteredVideos.length === 0 && videos.length > 0) {
      filterVideos('');
    }
  }, [videos, filteredVideos, filterVideos]);

  const displayVideos = filteredVideos.length > 0 ? filteredVideos : videos;

  return (
    <div className="p-4 md:p-6 pb-24">
      <div className="flex space-x-3 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        {['All', 'Music', 'Gaming', 'Live', 'News', 'Tech', 'Podcasts', 'Coding'].map((tag, i) => (
          <button key={tag} className={\`px-3 py-1.5 rounded-lg whitespace-nowrap text-sm font-medium transition-colors \${i === 0 ? 'bg-white text-black hover:bg-slate-200' : 'bg-slate-800 text-white hover:bg-slate-700'}\`}>
            {tag}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10">
        {displayVideos.map((video) => (
          <VideoCard
            key={video.id}
            id={video.id}
            thumbnail={video.thumbnailUrl}
            title={video.title}
            channel={video.channel}
            viewCount={video.views}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoGrid;`
  },
  {
    path: 'components/VideoPlayer.tsx',
    language: 'tsx',
    content: `import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, Share2, Download, MoreHorizontal } from 'lucide-react';
import CommentsSection from './CommentsSection';
import useVideoStore from '../videoStore';

const VideoPlayer: React.FC = () => {
  const { id } = useParams();
  const videos = useVideoStore((state) => state.videos);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  
  const video = videos.find(v => v.id === id) || videos[0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  return (
    <div className="flex flex-col lg:flex-row p-4 md:p-6 pb-24 max-w-[1800px] mx-auto">
      <div className="flex-1 lg:pr-6">
        <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-4 relative shadow-lg ring-1 ring-white/10 group">
          <video 
            src={video.videoUrl} 
            controls 
            autoPlay
            className="w-full h-full object-contain" 
            onPlay={() => setIsPlaying(true)} 
            onPause={() => setIsPlaying(false)}
            poster={video.thumbnailUrl}
          ></video>
        </div>
        <h1 className="text-white font-bold text-xl md:text-2xl mb-3">{video.title}</h1>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 cursor-pointer"></div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight cursor-pointer">{video.channel}</h3>
              <p className="text-slate-400 text-xs text-left">1.2M subscribers</p>
            </div>
            <button className="px-4 py-2 bg-white text-black font-bold text-sm rounded-full ml-2 hover:bg-slate-200 transition-colors">
              Subscribe
            </button>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex bg-slate-800/80 rounded-full h-9 items-center overflow-hidden">
              <button 
                onClick={() => setIsLiked(!isLiked)} 
                className={\`flex items-center space-x-2 px-4 h-full hover:bg-slate-700 transition-colors \${isLiked ? 'text-white' : 'text-slate-200'}\`}
              >
                <ThumbsUp size={18} fill={isLiked ? "currentColor" : "none"} />
                <span className="text-sm font-medium">{(video.views / 200).toFixed(1)}K</span>
              </button>
              <div className="w-px h-6 bg-slate-600"></div>
              <button className="px-4 h-full text-slate-200 hover:bg-slate-700 transition-colors">
                <ThumbsDown size={18} />
              </button>
            </div>
            <button className="flex items-center space-x-2 px-4 h-9 bg-slate-800/80 text-slate-200 rounded-full hover:bg-slate-700 transition-colors">
              <Share2 size={18} />
              <span className="text-sm font-medium hidden sm:inline">Share</span>
            </button>
            <button className="flex items-center space-x-2 px-4 h-9 bg-slate-800/80 text-slate-200 rounded-full hover:bg-slate-700 transition-colors">
              <Download size={18} />
              <span className="text-sm font-medium hidden sm:inline">Download</span>
            </button>
            <button className="flex items-center justify-center w-9 h-9 bg-slate-800/80 text-slate-200 rounded-full hover:bg-slate-700 transition-colors">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        <div className="bg-slate-800/60 hover:bg-slate-800 transition-colors p-4 rounded-xl cursor-pointer">
          <p className="font-medium text-white text-sm mb-1">{video.views.toLocaleString()} views • Premiered Oct 24, 2023</p>
          <p className="text-slate-300 text-sm line-clamp-2">
            This is a mock description for {video.title}. It explores amazing new technology concepts and showcases how developers can build things faster. Click to show more.
          </p>
        </div>

        <CommentsSection videoId={video.id} />
      </div>
      
      <div className="lg:w-[400px] flex-shrink-0 lg:pl-4 mt-8 lg:mt-0">
        <h3 className="text-white font-bold mb-4">Up next</h3>
        <div className="flex flex-col space-y-4">
          {videos.filter(v => v.id !== id).map(v => (
            <a href={\`/#/video/\${v.id}\`} key={v.id} className="flex space-x-2 group cursor-pointer">
              <div className="relative w-[168px] aspect-video rounded-xl overflow-hidden flex-shrink-0">
                <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded font-medium">8:22</div>
              </div>
              <div className="flex flex-col flex-1 py-1">
                <h4 className="text-white font-medium text-sm leading-tight line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors">{v.title}</h4>
                <p className="text-slate-400 text-xs">{v.channel}</p>
                <p className="text-slate-400 text-xs">{(v.views / 1000).toFixed(1)}K views</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;`
  },
  {
    path: 'videoStore.ts',
    language: 'ts',
    content: `import { create } from 'zustand';

interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  views: number;
  channel: string;
}

interface VideoStore {
  videos: Video[];
  filteredVideos: Video[];
  filterVideos: (query: string) => void;
}

const useVideoStore = create<VideoStore>((set) => ({
  videos: [
    { id: '1', thumbnailUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80', title: 'Building a Fullstack Next.js App in 10 Hours', channel: 'CodeMaster', views: 852000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { id: '2', thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80', title: 'Top 10 Retro Games You FORGOT About!', channel: 'RetroGamer', views: 340000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { id: '3', thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', title: 'Learn Modern CSS - A Complete Guide', channel: 'DesignPro', views: 1200000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { id: '4', thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80', title: 'The Future of AI Technology', channel: 'Tech Guru', views: 5400000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { id: '5', thumbnailUrl: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&q=80', title: '100 Days of Code - Python Challenge', channel: 'Pythonistas', views: 89000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { id: '6', thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80', title: 'Ultimate Desk Setup for Software Engineers', channel: 'WorkspaceGoals', views: 2100000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { id: '7', thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80', title: 'Understanding Algorithms and Data Structures', channel: 'CS Student', views: 450000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { id: '8', thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80', title: 'React Performance Optimization Rules', channel: 'React Ninjas', views: 67000, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  ],
  filteredVideos: [],
  filterVideos: (query: string) => set((state) => ({
    filteredVideos: query.trim() === '' 
      ? state.videos 
      : state.videos.filter(video => video.title.toLowerCase().includes(query.toLowerCase()) || video.channel.toLowerCase().includes(query.toLowerCase()))
  })),
}));

export default useVideoStore;`
  },
  {
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "youtube-clone",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "framer-motion": "^11.15.0",
    "zustand": "^5.0.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.2.2",
    "vite": "^4.4.5"
  }
}`
  },
  {
    path: 'vite.config.ts',
    language: 'typescript',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`
  }
];
