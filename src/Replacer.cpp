#include "Replacer.hpp"

Replacer::Replacer(const Config &config)
    : _config(config), _generators(config.generators()) {}

map<string, vector<std::pair<string, string>>> Replacer::generate_map() {
  map<string, vector<std::pair<string, string>>> result;
  auto lang_list = generate();
  for (auto lang : lang_list) {
    auto lang_generated = lang->result();
    for (auto lang_item : *lang_generated) {
      const string &src = lang_item.first;
      const string &dst = lang_item.second;
      const string &ns = lang->meta()->namespace_prefix();
      result[src].emplace_back(ns, dst);
    }
  }
  return result;
}

vector<shared_ptr<ILangResult>> Replacer::generate() {
  _result_cache.clear();
  _group_cache.clear();
  vector<shared_ptr<ILangResult>> results;
  for (auto gen : this->_generators) {
    if (gen->meta()->completed()) {
      auto new_results = _get_generator_results(gen);
      results.insert(results.end(), new_results.begin(), new_results.end());
    }
  }
  return results;
}

vector<shared_ptr<ILangResult>>
Replacer::get_group_results(const string &group) {
  auto gcache_found = _group_cache.find(group);
  if (gcache_found == _group_cache.end()) {
    // new group
    vector<shared_ptr<ILangResult>> results;
    for (auto gen : this->_generators) {
      if (gen->meta()->group() == group) {
        auto new_results = _get_generator_results(gen);
        results.insert(results.end(), new_results.begin(), new_results.end());
      }
    }
    _group_cache.emplace(group, results);
    return results;
  } else {
    // old group
    return gcache_found->second;
  }
}

vector<shared_ptr<ILangResult>>
Replacer::_get_generator_results(shared_ptr<Generator> gen) {
  auto rcache_found = _result_cache.find(gen);
  if (rcache_found == _result_cache.end()) {
    // new result
    auto new_results = gen->results(this);
    _result_cache[gen] = new_results;
    return new_results;
  } else {
    // old result
    return rcache_found->second;
  }
}

bool Replacer::_path_valid(const fs::path &path) {
  return (!path.empty()) && fs::exists(path);
}

bool Replacer::_read_language_file(const fs::path &path, LangFile &file) {
  if (!_path_valid(path)) {
    return false;
  }
  std::ifstream istrm(path.string(), std::ios::in);
  if (istrm) {
    istrm >> file;
    return true;
  } else {
    return false;
  }
}

bool Replacer::replace() {
  // check paths, load source
  LangFile main_source, extra_source, main_target, extra_target;
  bool valid_main_source =
           _read_language_file(_config.main_source_path(), main_source),
       valid_extra_source =
           _read_language_file(_config.extra_source_path(), extra_source),
       valid_main_target = _path_valid(_config.main_target_path()),
       valid_extra_target = _path_valid(_config.extra_target_path());
  if (!valid_main_source || !valid_main_target) {
    return false;
  }

  // replace
  auto dict = generate_map();
  const auto &items = main_source.items();
  for (const auto &item : items) {
  }

  return true;
}
