import { useState, useEffect } from 'react'
import './index.css'

interface Offer {
  id: number;
  store: string;
  title: string;
  price: number;
  percentage: number;
  link: string;
  image: string;
}

interface GameGroup {
  normalized_title: string;
  best_price: number;
  best_offer: Offer;
  all_offers: Offer[];
  image: string;
}

function App() {
  const [games, setGames] = useState<GameGroup[]>([])
  const [stores, setStores] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [loading, setLoading] = useState(true)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  useEffect(() => {
    fetchStores()
  }, [])

  useEffect(() => {
    fetchGames()
  }, [search, selectedStore])

  const fetchStores = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stores`)
      const data = await res.json()
      setStores(data)
    } catch (error) {
      console.error('Error fetching stores:', error)
    }
  }

  const fetchGames = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedStore) params.append('store', selectedStore)

      const res = await fetch(`${API_URL}/api/games?${params.toString()}`)
      const data = await res.json()
      setGames(data)
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">PS4/PS5 Deals Marketplace</h1>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search games..."
            className="flex-1 border p-2 rounded focus:ring focus:ring-blue-200 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="border p-2 rounded bg-white outline-none"
            value={selectedStore}
            onChange={e => setSelectedStore(e.target.value)}
          >
            <option value="">All Stores</option>
            {stores.map(store => (
              <option key={store} value={store}>{store}</option>
            ))}
          </select>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center text-xl text-gray-500 py-12">Loading deals...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {games.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-12">No games found</div>
            ) : (
              games.map((group, i) => (
                <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                  {/* Image */}
                  <div className="h-48 bg-gray-200 w-full relative">
                    {group.image && group.image.startsWith('http') ? (
                       <img src={group.image} alt={group.best_offer.title} className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                    {group.best_offer.percentage > 0 && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white font-bold px-2 py-1 rounded">
                        -{group.best_offer.percentage}%
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <h2 className="font-semibold text-lg text-gray-800 line-clamp-2 mb-2" title={group.best_offer.title}>
                      {group.best_offer.title}
                    </h2>

                    <div className="mt-auto">
                      <div className="text-sm text-gray-500 mb-1">Best price at: <span className="font-bold text-gray-700">{group.best_offer.store}</span></div>
                      <div className="text-2xl font-bold text-green-600 mb-4">
                        R$ {group.best_price.toFixed(2).replace('.', ',')}
                      </div>

                      {/* Other Offers */}
                      {group.all_offers.length > 1 && (
                        <div className="mt-2 pt-2 border-t text-sm">
                          <span className="text-gray-500 mb-1 block">Also available at:</span>
                          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                            {group.all_offers.slice(1).map(offer => (
                              <div key={offer.id} className="flex justify-between items-center text-xs">
                                <span>{offer.store}</span>
                                <span>R$ {offer.price.toFixed(2).replace('.', ',')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <a
                        href={group.best_offer.link || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={`block w-full text-center py-2 rounded font-medium mt-4 ${group.best_offer.link ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                      >
                        {group.best_offer.link ? 'Go to Store' : 'No Link Available'}
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
