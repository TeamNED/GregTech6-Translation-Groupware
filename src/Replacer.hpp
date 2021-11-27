#ifndef REPLACER_H
#define REPLACER_H
#pragma once

#include <algorithm>
#include <exception>
#include <map>
#include <unordered_map>

#include "config/Config.hpp"
#include "lang/LangFile.hpp"
#include "meta/GeneratorMeta.hpp"
#include "meta/IGroupRepository.hpp"

using std::map;

class Replacer : public IGroupRepository {

private:
  const Config &_config;
  const vector<shared_ptr<Generator>> &_generators;
  std::unordered_map<shared_ptr<Generator>, vector<shared_ptr<ILangResult>>>
      _result_cache;
  std::unordered_map<string, vector<shared_ptr<ILangResult>>> _group_cache;

  vector<shared_ptr<ILangResult>>
  _get_generator_results(shared_ptr<Generator> gen);

  static bool _path_valid(const fs::path &path);
  static bool _read_language_file(const fs::path &path, LangFile &file);
  static bool _write_language_file(const fs::path &path, const LangFile &file);

public:
  Replacer(const Config &config);
  map<string, vector<std::pair<shared_ptr<IGeneratorMeta>, string>>>
  generate_map();
  vector<shared_ptr<ILangResult>> generate();
  virtual vector<shared_ptr<ILangResult>>
  get_group_results(const string &group) override;
  bool replace();
};
#endif