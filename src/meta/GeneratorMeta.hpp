#ifndef GENERATORMETA_H
#define GENERATORMETA_H
#pragma once

#include "IGeneratorMeta.hpp"

class GeneratorMeta : public virtual IGeneratorMeta {
private:
  string _group, _namespace_prefix;
  bool _cached = true, _completed = true;
  vector<string> _extentions;

public:
  GeneratorMeta() = default;
  GeneratorMeta(string group, string namespace_prefix, bool cached,
                bool completed, vector<string> extensions);
  GeneratorMeta(const GeneratorMeta &) = default;
  GeneratorMeta(GeneratorMeta &&) = default;
  GeneratorMeta &operator=(const GeneratorMeta &) = default;
  GeneratorMeta &operator=(GeneratorMeta &&) = default;
  virtual ~GeneratorMeta() = default;

  virtual string &group();
  virtual string &namespace_prefix();
  virtual bool &cached();
  virtual bool &completed();
  virtual vector<string> &extentions();

  virtual const string &group() const override;
  virtual const string &namespace_prefix() const override;
  virtual bool cached() const override;
  virtual bool completed() const override;
  virtual const vector<string> &extentions() const override;
};
#endif