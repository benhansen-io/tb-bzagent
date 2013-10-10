(defproject td-bzagent "0.1.0-SNAPSHOT"
  :description "FIXME: write description"
  :url "http://example.com/FIXME"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.5.1"] [org.clojure/clojurescript "0.0-1913"]]
  :plugins [[lein-cljsbuild "0.3.3"]]
  :cljsbuild {
    :builds {
      :main {:source-paths ["src-cljs-agent"]
            :compiler {:output-to "build/agent.js" :optimizations :simple :target :nodejs}
      }
    }
  }
)
