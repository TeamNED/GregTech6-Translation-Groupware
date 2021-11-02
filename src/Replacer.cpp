#include "Replacer.hpp"

Replacer::Replacer(const vector<shared_ptr<Generator>> &generators)
    : _generators(generators) {}

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
